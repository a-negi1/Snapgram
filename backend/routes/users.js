const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Notification = require("../models/Notification");
const { authenticate } = require("../middleware/auth");



router.get("/me", authenticate, async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.user.uid });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});





router.post("/me", authenticate, async (req, res) => {
  try {
    const { username, displayName, photoURL, bio } = req.body;

    

    let user = await User.findOne({ uid: req.user.uid });
    if (user) return res.json(user);

    

    

    const base = (username || req.user.email?.split("@")[0] || "user")
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "_")   

      .replace(/_+/g, "_")           

      .slice(0, 28);                 


    const candidates = [
      base,
      `${base}_${req.user.uid.slice(0, 5)}`,
      `${base}_${req.user.uid.slice(0, 8)}`,
      `user_${req.user.uid}`,        

    ];

    for (const candidate of candidates) {
      try {
        user = await User.create({
          uid: req.user.uid,
          username: candidate,
          displayName: displayName || "",
          photoURL: photoURL || "",
          bio: bio || "",
        });
        return res.status(201).json(user);
      } catch (err) {
        if (err.code === 11000 && err.keyValue?.username) {
          

          continue;
        }
        if (err.code === 11000 && err.keyValue?.uid) {
          

          user = await User.findOne({ uid: req.user.uid });
          return res.json(user);
        }
        throw err; 

      }
    }

    

    res.status(500).json({ error: "Could not create user profile" });

  } catch (err) {
    console.error("POST /api/users/me error:", err.message);
    res.status(500).json({ error: err.message });
  }
});




router.put("/me", authenticate, async (req, res) => {
  try {
    const { displayName, bio, username, photoURL } = req.body;
    const updates = {};
    if (displayName !== undefined) updates.displayName = displayName.trim();
    if (bio !== undefined) updates.bio = bio.trim();
    if (username !== undefined)
      updates.username = username.trim().toLowerCase().replace(/\s+/g, "_");
    if (photoURL !== undefined) updates.photoURL = photoURL;

    const user = await User.findOneAndUpdate(
      { uid: req.user.uid },
      { $set: updates },
      { new: true }
    );
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



router.get("/suggestions", authenticate, async (req, res) => {
  try {
    const me = await User.findOne({ uid: req.user.uid });
    const exclude = [req.user.uid, ...(me?.following || [])];
    const users = await User.find({ uid: { $nin: exclude } }).limit(10);
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



router.get("/search", authenticate, async (req, res) => {
  try {
    const q = (req.query.q || "").toLowerCase().trim();
    if (!q) return res.json([]);
    

    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const users = await User.find({
      username: { $regex: `^${escaped}`, $options: "i" },
    }).limit(10);
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



router.get("/:uid", authenticate, async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.params.uid });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});





router.post("/:uid/follow", authenticate, async (req, res) => {
  const targetUid = req.params.uid;
  const myUid = req.user.uid;
  if (targetUid === myUid) return res.status(400).json({ error: "Cannot follow yourself" });
  try {
    const [target, me] = await Promise.all([
      User.findOne({ uid: targetUid }),
      User.findOne({ uid: myUid }),
    ]);
    if (!target || !me) return res.status(404).json({ error: "User not found" });

    const isFollowing = me.following.includes(targetUid);
    if (isFollowing) {
      await User.updateOne({ uid: myUid }, { $pull: { following: targetUid } });
      await User.updateOne({ uid: targetUid }, { $pull: { followers: myUid } });
      return res.json({ following: false });
    } else {
      await User.updateOne({ uid: myUid }, { $addToSet: { following: targetUid } });
      await User.updateOne({ uid: targetUid }, { $addToSet: { followers: myUid } });
      const notif = await Notification.create({
        toUid: targetUid,
        fromUid: myUid,
        fromUsername: me.username,
        fromPhotoURL: me.photoURL || "",
        type: "follow",
      });
      

      req.app.io.to(targetUid).emit("notification", notif);
      return res.json({ following: true });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



router.get("/:uid/followers", authenticate, async (req, res) => {
  try {
    const target = await User.findOne({ uid: req.params.uid });
    if (!target) return res.status(404).json({ error: "User not found" });
    const followers = await User.find({ uid: { $in: target.followers } }).limit(50);
    res.json(followers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



router.get("/:uid/following", authenticate, async (req, res) => {
  try {
    const target = await User.findOne({ uid: req.params.uid });
    if (!target) return res.status(404).json({ error: "User not found" });
    const following = await User.find({ uid: { $in: target.following } }).limit(50);
    res.json(following);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
