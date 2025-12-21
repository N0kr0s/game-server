const express = require('express');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// ==================== ПОДКЛЮЧЕНИЕ К MongoDB ====================
mongoose.connect(process.env.MONGO_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err));

// ==================== СХЕМЫ ====================
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  password_hash: { type: String, required: true },
  created_at: { type: Date, default: Date.now }
});

const saveSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  custom_value: { type: String, default: "" },
  total_score: { type: Number, default: 0 },
  updated_at: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Save = mongoose.model('Save', saveSchema);

// ==================== HEALTH CHECK ====================
app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running', timestamp: new Date() });
});

// ==================== РЕГИСТРАЦИЯ ====================
app.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Проверка полей
    if (!username || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Username and password required' 
      });
    }

    // Проверка существования пользователя
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(409).json({ 
        success: false, 
        error: 'User already exists' 
      });
    }
    
    // Хеширование пароля и создание пользователя
    const hash = await bcrypt.hash(password, 10);
    const newUser = new User({ username, password_hash: hash });
    await newUser.save();
    
    // Создание дефолтного сохранения
    const defaultSave = new Save({ 
      username, 
      custom_value: "",
      total_score: 0
    });
    await defaultSave.save();
    
    console.log(`✅ User registered: ${username}`);
    res.json({ 
      success: true, 
      message: 'Registration successful',
      username: username
    });
  } catch (error) {
    console.error('❌ Register error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error during registration' 
    });
  }
});

// ==================== ВХОД ====================
app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Проверка полей
    if (!username || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Username and password required' 
      });
    }
    
    // Поиск пользователя
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        error: 'User not found' 
      });
    }
    
    // Проверка пароля
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid password' 
      });
    }
    
    // Получение данных игры
    let gameData = await Save.findOne({ username });
    if (!gameData) {
      gameData = new Save({ username });
      await gameData.save();
    }
    
    console.log(`✅ User logged in: ${username}`);
    res.json({
      success: true,
      username: username,
      gameData: {
        username: gameData.username,
        custom_value: gameData.custom_value,
        total_score: gameData.total_score,
        updated_at: gameData.updated_at
      }
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Server error during login' 
    });
  }
});

// ==================== СОХРАНЕНИЕ ИГРЫ ====================
app.post('/save', async (req, res) => {
  try {
    const { username, custom_value, total_score } = req.body;
    
    // Проверка username
    if (!username) {
      return res.status(400).json({ 
        success: false, 
        error: 'Username required' 
      });
    }
    
    // Обновление или создание сохранения
    const updatedSave = await Save.findOneAndUpdate(
      { username },
      { 
        custom_value: custom_value || "",
        total_score: total_score || 0,
        updated_at: new Date() 
      },
      { upsert: true, new: true }
    );
    
    console.log(`💾 Game saved for user: ${username}`);
    res.json({ 
      success: true,
      message: 'Game saved successfully',
      gameData: updatedSave
    });
  } catch (error) {
    console.error('❌ Save error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to save game' 
    });
  }
});

// ==================== ПОЛУЧЕНИЕ ДАННЫХ ====================
app.get('/load/:username', async (req, res) => {
  try {
    const { username } = req.params;
    
    const gameData = await Save.findOne({ username });
    if (!gameData) {
      return res.status(404).json({ 
        success: false, 
        error: 'Save data not found' 
      });
    }
    
    console.log(`📥 Loaded data for user: ${username}`);
    res.json({
      success: true,
      gameData: gameData
    });
  } catch (error) {
    console.error('❌ Load error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to load game' 
    });
  }
});

// ==================== ОБРАБОТЧИК ОШИБОК ====================
app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err);
  res.status(500).json({ 
    success: false, 
    error: 'Internal server error' 
  });
});

// ==================== ЗАПУСК СЕРВЕРА ====================
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔════════════════════════════════════════╗
║   🎮 Game Server ЗАПУЩЕН!             ║
║   Port: ${PORT}                            
║   MongoDB: ${process.env.MONGO_URL ? '✅ Connected' : '❌ Not set'}
╚════════════════════════════════════════╝
  `);
});

// Обработка необработанных Promise rejection
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection:', reason);
});
