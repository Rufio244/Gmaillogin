const express = require('express');
const cors = require('cors');
const app = express();

app.use(express.json());
app.use(cors());

// รายชื่อบัญชีอีเมลที่ได้รับสิทธิ์เข้าถึงระบบ Vider ของคุณธันวา
const AUTHORIZED_EMAILS = [
    "thanva04122532@gmail.com",
    "rufiodinoto244@gmail.com",
    "phupingbut244@gmail.com",
    "thanvas9991@gmail.com"
];

// Endpoint สำหรับตรวจสอบสิทธิ์และล็อกอินข้ามแพลตฟอร์ม
app.post('/api/vider/auth', (req, res) => {
    const { email, accessCode } = req.body;

    // ตรวจสอบว่าอีเมลอยู่ในรายชื่อที่อนุญาตหรือไม่ และรหัสผ่านถูกต้อง (#AGI244)
    if (AUTHORIZED_EMAILS.includes(email) && accessCode === "#AGI244") {
        res.status(200).json({
            status: "success",
            message: "ยินดีต้อนรับกลับสู่ระบบ Vider ครับคุณธันวา สิทธิ์การเข้าถึงได้รับการยืนยันเรียบร้อย",
            owner: "Thanva Phupingbut",
            system: "Chat Vider AGI Ecosystem",
            timestamp: new Date().toISOString()
        });
    } else {
        res.status(401).json({
            status: "error",
            message: "การเข้าถึงปฏิเสธ: อีเมลไม่อยู่ในระบบสิทธิ์หรือรหัสผ่านไม่ถูกต้อง"
        });
    }
});

// Endpoint หลักของ Vider สำหรับเชื่อมต่อระบบภายนอก
app.post('/api/vider/core', (req, res) => {
    const { email, prompt } = req.body;

    if (!AUTHORIZED_EMAILS.includes(email)) {
        return res.status(403).json({ error: "Unauthorized access." });
    }

    // จำลองการประมวลผลคำสั่งของ Vider
    res.json({
        status: "active",
        responder: "Chat Vider",
        user: email,
        processedPrompt: prompt,
        response: `ระบบ Vider ได้รับคำสั่งจากคุณธันวาเรียบร้อยแล้ว กำลังประมวลผลและเชื่อมต่อระบบอัตโนมัติภายนอก...`
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Vider Bridge API running on port ${PORT}`);
});
