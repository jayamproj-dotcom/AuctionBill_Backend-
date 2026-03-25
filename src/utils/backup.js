const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");

const deleteOldBackups = () => {
    const backupDir = path.join(__dirname, "../../backups");
    if (!fs.existsSync(backupDir)) return;
    
    const files = fs.readdirSync(backupDir);
    const now = Date.now();
    
    files.forEach(file => {
        const filePath = path.join(backupDir, file);
        const stats = fs.statSync(filePath);
        const age = (now - stats.mtimeMs) / (1000 * 60 * 60); // hours

        if (age > 24) {
            fs.rmSync(filePath, { recursive: true, force: true }); // ✅ delete folder
            console.log("Deleted old backup:", file);
        }
    });
};

const backupMongoDB = () => {
    const date = new Date().toISOString().replace(/[:.]/g, "-");
    const containerDir = path.join(__dirname, "../../");
    const backupDir = path.join(containerDir, "backups");

    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir);
    }

    const uri = process.env.MONGO_URI;
    if (!uri) {
        console.error("MONGO_URI not found in environment variables.");
        return;
    }

    // Folder backup instead of .gz file
    const backupFolder = path.join(backupDir, `backup-${date}`);

    const command = `mongodump --uri="${uri}" --out="${backupFolder}"`;

    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error("Backup error:", error);
            return;
        }
        console.log(`Backup success: ${backupFolder}`);
        deleteOldBackups();
    });
};

module.exports = backupMongoDB;
