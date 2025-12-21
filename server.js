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
  total_score: { type: Number, default: 0 },
  current_skin: { type: Number, default: 0 },
  players_skins: { type: [Number], default: [0] },
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
      total_score: 0,
      current_skin: 0,
      players_skins: [0]
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
      gameData = new Save({ 
        username,
        total_score: 0,
        current_skin: 0,
        players_skins: [0]
      });
      await gameData.save();
    }
    
    console.log(`✅ User logged in: ${username}`);
    res.json({
      success: true,
      username: username,
      gameData: {
        username: gameData.username,
        total_score: gameData.total_score,
        current_skin: gameData.current_skin,
        players_skins: gameData.players_skins,
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
    const { username, total_score, current_skin, players_skins } = req.body;
    
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
        total_score: total_score || 0,
        current_skin: current_skin || 0,
        players_skins: players_skins || [0],
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

// ==================== ПОЛУЧЕНИЕ ДАННЫХ ОДНОГО ИГРОКА ====================
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

// ==================== ПОЛУЧЕНИЕ ВСЕХ ИГРОКОВ И СОХРАНЕНИЙ ====================
app.get('/api/players', async (req, res) => {
  try {
    // Получаем все сохранения игроков с информацией о пользователях
    const allSaves = await Save.find({}, {
      username: 1,
      total_score: 1,
      current_skin: 1,
      players_skins: 1,
      updated_at: 1
    }).lean();
    
    // Получаем информацию о пользователях
    const allUsers = await User.find({}, {
      username: 1,
      created_at: 1
    }).lean();
    
    // Объединяем данные пользователей с их сохранениями
    const playersData = allSaves.map(save => {
      const user = allUsers.find(u => u.username === save.username);
      return {
        username: save.username,
        total_score: save.total_score,
        current_skin: save.current_skin,
        players_skins: save.players_skins,
        account_created_at: user?.created_at || null,
        last_updated: save.updated_at
      };
    });
    
    console.log(`📊 Retrieved ${playersData.length} players with save data`);
    res.json({
      success: true,
      count: playersData.length,
      players: playersData
    });
  } catch (error) {
    console.error('❌ Get all players error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to retrieve players' 
    });
  }
});

// ==================== ПОЛУЧЕНИЕ ДАННЫХ КОНКРЕТНОГО ИГРОКА ====================
app.get('/api/player/:username', async (req, res) => {
  try {
    const { username } = req.params;
    
    const gameData = await Save.findOne({ username }, {
      username: 1,
      total_score: 1,
      current_skin: 1,
      players_skins: 1,
      updated_at: 1
    }).lean();
    
    if (!gameData) {
      return res.status(404).json({
        success: false,
        error: 'Player not found'
      });
    }
    
    console.log(`🎮 Retrieved data for player: ${username}`);
    res.json({
      success: true,
      gameData: gameData
    });
  } catch (error) {
    console.error('❌ Get player error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// ==================== УДАЛЕНИЕ: ТОЛЬКО СОХРАНЕНИЕ ИГРЫ ====================
app.delete('/delete-save/:username', async (req, res) => {
  try {
    const { username } = req.params;
    
    // Проверяем наличие username
    if (!username) {
      return res.status(400).json({
        success: false,
        error: 'Username required'
      });
    }
    
    // Удаляем сохранение игры
    const deletedSave = await Save.findOneAndDelete({ username });
    
    if (!deletedSave) {
      return res.status(404).json({
        success: false,
        error: 'Save data not found'
      });
    }
    
    console.log(`🗑️ Save deleted for user: ${username}`);
    
    res.json({
      success: true,
      message: `Save data for ${username} has been deleted. Account still exists.`
    });
  } catch (error) {
    console.error('❌ Delete save error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during delete'
    });
  }
});

// ==================== УДАЛЕНИЕ: ПОЛНОСТЬЮ АККАУНТ (БЕЗ ПРОВЕРКИ) ====================
app.delete('/delete-account/:username', async (req, res) => {
  try {
    const { username } = req.params;
    
    if (!username) {
      return res.status(400).json({
        success: false,
        error: 'Username required'
      });
    }
    
    // Удаляем пользователя
    const deletedUser = await User.findOneAndDelete({ username });
    
    // Удаляем сохранение
    const deletedSave = await Save.findOneAndDelete({ username });
    
    if (!deletedUser && !deletedSave) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    console.log(`💥 Account completely deleted: ${username}`);
    
    res.json({
      success: true,
      message: `Account ${username} and all associated data have been permanently deleted`
    });
  } catch (error) {
    console.error('❌ Delete account error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during account deletion'
    });
  }
});

// ==================== УДАЛЕНИЕ: АККАУНТ С ПРОВЕРКОЙ ПАРОЛЯ (БЕЗОПАСНО) ====================
app.delete('/delete-account-secure', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Проверка полей
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username and password required'
      });
    }
    
    // Находим пользователя
    const user = await User.findOne({ username });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    // Проверяем пароль
    const isValid = await bcrypt.compare(password, user.password_hash);
    
    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid password - account not deleted'
      });
    }
    
    // Удаляем пользователя и сохранение
    await User.findOneAndDelete({ username });
    await Save.findOneAndDelete({ username });
    
    console.log(`🔐 Account securely deleted: ${username}`);
    
    res.json({
      success: true,
      message: `Account ${username} has been permanently deleted with password verification`
    });
  } catch (error) {
    console.error('❌ Secure delete error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// ==================== СБРОС ПРОГРЕССА (АККАУНТ ОСТАЁТСЯ) ====================
app.post('/reset-progress/:username', async (req, res) => {
  try {
    const { username } = req.params;
    
    if (!username) {
      return res.status(400).json({
        success: false,
        error: 'Username required'
      });
    }
    
    // Проверяем что пользователь существует
    const user = await User.findOne({ username });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
    // Сбрасываем прогресс
    const resetSave = await Save.findOneAndUpdate(
      { username },
      {
        total_score: 0,
        current_skin: 0,
        players_skins: [0],
        updated_at: new Date()
      },
      { upsert: true, new: true }
    );
    
    console.log(`🔄 Progress reset for user: ${username}`);
    
    res.json({
      success: true,
      message: 'Progress has been reset',
      gameData: resetSave
    });
  } catch (error) {
    console.error('❌ Reset progress error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// ==================== АДМИН: ВСЕ СОХРАНЕНИЯ ====================
app.get('/admin/saves', async (req, res) => {
  try {
    const saves = await Save.find({});
    
    console.log(`📊 Retrieved ${saves.length} saves`);
    res.json({
      success: true,
      count: saves.length,
      saves: saves
    });
  } catch (error) {
    console.error('❌ Get saves error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to retrieve saves' 
    });
  }
});

// ==================== АДМИН: СБРОС ПАРОЛЯ ====================
app.post('/admin/reset-password/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const { new_password } = req.body;
    
    if (!new_password) {
      return res.status(400).json({ 
        success: false, 
        error: 'New password required' 
      });
    }
    
    // Проверка что пользователь существует
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }
    
    // Хеширование и сохранение нового пароля
    const hash = await bcrypt.hash(new_password, 10);
    await User.updateOne(
      { username },
      { password_hash: hash }
    );
    
    console.log(`🔄 Password reset for user: ${username}`);
    res.json({
      success: true,
      message: `Password for user "${username}" has been reset to: ${new_password}`
    });
  } catch (error) {
    console.error('❌ Reset password error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to reset password' 
    });
  }
});

// ==================== ИЗМЕНЕНИЕ ПАРОЛЯ (В ИГРЕ) ====================
app.post('/change-password', async (req, res) => {
  try {
    const { username, old_password, new_password } = req.body;
    
    if (!username || !old_password || !new_password) {
      return res.status(400).json({ 
        success: false, 
        error: 'All fields required' 
      });
    }
    
    // Поиск пользователя
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found' 
      });
    }
    
    // Проверка старого пароля
    const isValid = await bcrypt.compare(old_password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ 
        success: false, 
        error: 'Old password is incorrect' 
      });
    }
    
    // Хеширование и сохранение нового пароля
    const hash = await bcrypt.hash(new_password, 10);
    await User.updateOne(
      { username },
      { password_hash: hash }
    );
    
    console.log(`🔄 Password changed for user: ${username}`);
    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('❌ Change password error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to change password' 
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
║                                        ║
║   📍 Основные эндпоинты:              ║
║   POST   /register                    ║
║   POST   /login                       ║
║   POST   /save                        ║
║   GET    /load/:username              ║
║                                        ║
║   📊 Получение данных:                ║
║   GET    /api/players        (все)    ║
║   GET    /api/player/:username        ║
║                                        ║
║   🗑️  Удаление:                       ║
║   DELETE /delete-save/:username       ║
║   DELETE /delete-account/:username    ║
║   DELETE /delete-account-secure       ║
║                                        ║
║   🔄 Другое:                          ║
║   POST   /reset-progress/:username    ║
║   POST   /change-password             ║
║   POST   /admin/reset-password        ║
║                                        ║
╚════════════════════════════════════════╝
  `);
});

// Обработка необработанных Promise rejection
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection:', reason);
});
