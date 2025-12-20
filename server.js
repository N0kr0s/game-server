const express = require('express');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Подключение к MongoDB
mongoose.connect(process.env.MONGO_URL);

// Схема пользователя
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  password_hash: { type: String, required: true },
  created_at: { type: Date, default: Date.now }
});

// Схема сохранения
const saveSchema = new mongoose.Schema({
  username: { type: String, required: true },
  custom_value: { type: String, default: "" },
  total_score: { type: Number, default: 0 },
  updated_at: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Save = mongoose.model('Save', saveSchema);

// РЕГИСТРАЦИЯ
app.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.json({ success: false, error: 'Required' });
    }
    
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.json({ success: false, error: 'Exists' });
    }
    
    const hash = await bcrypt.hash(password, 10);
    const newUser = new User({ username, password_hash: hash });
    await newUser.save();
    
    const defaultSave = new Save({ username, custom_value: "" });
    await defaultSave.save();
    
    console.log('✅ User registered: ' + username);
    res.json({ success: true, message: 'Registration successful' });
  } catch (e) {
    console.error('Register error:', e);
    res.json({ success: false, error: 'Server error' });
  }
});

// ВХОД
app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.json({ success: false, error: 'Required' });
    }
    
    const user = await User.findOne({ username });
    if (!user) {
      return res.json({ success: false, error: 'Not found' });
    }
    
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.json({ success: false, error: 'Wrong' });
    }
    
    const gameData = await Save.findOne({ username });
    
    console.log('✅ User logged in: ' + username);
    res.json({
      success: true,
      username: username,
      gameData: gameData
    });
  } catch (e) {
    console.error('Login error:', e);
    res.json({ success: false, error: 'Server error' });
  }
});

// СОХРАНЕНИЕ
app.post('/save', async (req, res) => {
  try {
    const { username, custom_value } = req.body;
    
    if (!username) {
      return res.json({ success: false, error: 'Username required' });
    }
    
    await Save.findOneAndUpdate(
      { username },
      { custom_value, updated_at: new Date() },
      { upsert: true }
    );
    
    console.log('💾 Saved for user: ' + username);
    res.json({ success: true });
  } catch (e) {
    console.error('Save error:', e);
    res.json({ success: false, error: 'Save failed' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log('🎮 Game Server running on port ' + PORT);
});
