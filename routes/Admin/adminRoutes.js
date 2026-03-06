// backend/routes/Admin/adminRoutes.js
const express = require("express");
const router = express.Router();
const nodemailer = require("nodemailer");
const User = require("../../models/User");

// ================= CONSTANTS =================
const FACE_THRESHOLD = 0.5;

// ================= HELPERS =================
function euclideanDistance(arr1, arr2) {
  if (!arr1 || !arr2 || arr1.length !== arr2.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < arr1.length; i++) {
    sum += (arr1[i] - arr2[i]) ** 2;
  }
  return Math.sqrt(sum);
}

// ================= SEND INVITE EMAIL =================
router.post("/send-invite", async (req, res) => {
  try {
    const { name, email, empId } = req.body;

    if (!name || !email || !empId)
      return res.status(400).json({ message: "Missing required fields" });

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "techngparames@gmail.com",
        pass: "hftvxwsjoojnkisw",
      },
    });

    const faceLoginLink = `http://localhost:3000/face-login?name=${encodeURIComponent(
      name
    )}&email=${encodeURIComponent(email)}&empId=${encodeURIComponent(empId)}`;

    await transporter.sendMail({
      from: "techngparames@gmail.com",
      to: email,
      subject: "Setup Your Face Login",
      html: `
        <h2>Hello ${name}</h2>
        <p>Your Employee ID: <b>${empId}</b></p>
        <p>Email: <b>${email}</b></p>
        <a href="${faceLoginLink}" 
        style="padding:12px 25px;background:#1abc9c;color:white;border-radius:8px;text-decoration:none;">
        Setup Face Login
        </a>
      `,
    });

    res.json({ success: true, message: "Invite sent" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

// ================= REGISTER EMPLOYEE FACE =================
router.post("/register-employee", async (req, res) => {
  try {
    const { name, email, employeeId, faceDescriptor } = req.body;

    if (!name || !email || !employeeId || !faceDescriptor)
      return res.status(400).json({ message: "Missing required fields" });

    const existing = await User.findOne({ $or: [{ email }, { employeeId }] });
    if (existing)
      return res.status(400).json({ message: "Employee already exists" });

    const newUser = new User({
      name,
      email,
      employeeId,
      faceDescriptor,
      loginCount: 0,
    });

    await newUser.save();
    res.json({ success: true, message: "Employee registered successfully ✅", user: newUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Registration failed ❌" });
  }
});

// ================= FACE LOGIN =================
router.post("/face-login", async (req, res) => {
  try {
    const { faceDescriptor } = req.body;
    const allUsers = await User.find();

    for (let user of allUsers) {
      const distance = euclideanDistance(faceDescriptor, user.faceDescriptor);
      if (distance < FACE_THRESHOLD) {
        user.lastLogin = new Date();
        user.loginCount += 1;
        await user.save();
        return res.json({ success: true, user });
      }
    }

    res.json({ success: false, message: "Face not recognized" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

// ================= EMPLOYEE ACTION =================
// POST /api/admin/employee/action
router.post("/employee/action", async (req, res) => {
  try {
    const { employeeId, action } = req.body;
    if (!employeeId || !action) return res.status(400).json({ success: false, message: "Missing fields" });

    const user = await User.findOne({ employeeId });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const now = new Date();
    user.loginHistory = user.loginHistory || [];

    if (action === "login") {
      // Start new session
      user.loginHistory.push({ loginTime: now, logoutTime: null, pauseTime: null });
    } else if (action === "pause") {
      // Pause current session
      if (user.loginHistory.length > 0) {
        user.loginHistory[user.loginHistory.length - 1].pauseTime = now;
      }
    } else if (action === "logout") {
      // End current session
      if (user.loginHistory.length > 0) {
        user.loginHistory[user.loginHistory.length - 1].logoutTime = now;
      }
    }

    await user.save();
    res.json({ success: true, message: `${action} recorded`, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Action failed" });
  }
});
// ================= EMPLOYEES LIST =================
router.get("/employees", async (req, res) => {
  try {
    const employees = await User.find().sort({ createdAt: -1 });
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const activeToday = employees.filter(
      (emp) => emp.lastLogin && new Date(emp.lastLogin) >= today
    );

    res.json({
      success: true,
      totalEmployees: employees.length,
      activeToday: activeToday.length,
      employees,
    });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// ================= EMPLOYEE ACTIVITY =================
router.get("/employee-activity", async (req, res) => {
  try {
    const employees = await User.find(
      {},
      { name: 1, email: 1, employeeId: 1, loginHistory: 1 }
    );
    res.json({ success: true, employees });
  } catch (err) {
    console.error("Error fetching employee activity:", err);
    res.status(500).json({ success: false, message: "Failed to fetch activity" });
  }
});
// ================= ACTIVITY =================

// backend/routes/Admin/adminRoutes.js
router.post("/employee/action", async (req, res) => {
  try {
    const { employeeId, action } = req.body;

    if (!employeeId || !action) {
      return res.status(400).json({ success: false, message: "Missing fields" });
    }

    const user = await User.findOne({ employeeId });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const now = new Date();

    if (action === "login") {
      user.loginHistory = user.loginHistory || [];
      user.loginHistory.push({ loginTime: now, logoutTime: null, pauseTime: null });
      user.lastLogin = now;
      user.loginCount += 1;
    } else if (action === "pause") {
      if (user.loginHistory && user.loginHistory.length > 0) {
        const last = user.loginHistory[user.loginHistory.length - 1];
        last.pauseTime = now;
      }
    } else if (action === "logout") {
      if (user.loginHistory && user.loginHistory.length > 0) {
        const last = user.loginHistory[user.loginHistory.length - 1];
        last.logoutTime = now;
      }
    }

    await user.save();
    res.json({ success: true, message: `${action} recorded`, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Action failed" });
  }
});
// ================= COUNT =================
router.get("/employee-count", async (req, res) => {
  const count = await User.countDocuments();
  res.json({ success: true, totalEmployees: count });
});

// ================= DELETE =================
router.delete("/employee/:id", async (req, res) => {
  await User.findByIdAndDelete(req.params.id);
  res.json({ success: true, message: "Employee removed" });
});

// ================= UPDATE =================
router.put("/employee/:id", async (req, res) => {
  const updated = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json({ success: true, employee: updated });
});

// ================= ONBOARDED EMPLOYEES =================
router.get("/onboarded-employees", async (req, res) => {
  try {
    const employees = await User.find(
      {},
      { _id: 0, employeeId: 1, name: 1, email: 1, faceDescriptor: 1 }
    );

    res.status(200).json({ success: true, employees });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to fetch onboarded employees" });
  }
});

module.exports = router;