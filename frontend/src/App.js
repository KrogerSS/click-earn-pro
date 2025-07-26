import React, { useState, useEffect, createContext, useContext } from 'react';
import './App.css';

// Auth Context
const AuthContext = createContext();

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Auth Provider Component
const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = () => {
    const sessionToken = localStorage.getItem('session_token');
    const userData = localStorage.getItem('user_data');
    
    if (sessionToken && userData) {
      setUser(JSON.parse(userData));
    }
    setLoading(false);
  };

  const login = () => {
    const redirectUrl = encodeURIComponent(window.location.origin + '/profile');
    window.location.href = `https://auth.emergentagent.com/?redirect=${redirectUrl}`;
  };

  const logout = () => {
    localStorage.removeItem('session_token');
    localStorage.removeItem('user_data');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

// Header Component
const Header = () => {
  const { user, logout } = useAuth();

  return (
    <header className="bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <div className="text-2xl">💰</div>
          <h1 className="text-2xl font-bold">ClickEarn Pro</h1>
        </div>
        
        {user && (
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <img 
                src={user.picture || '/api/placeholder/32/32'} 
                alt="Profile" 
                className="w-8 h-8 rounded-full"
              />
              <span className="hidden md:block">{user.name}</span>
            </div>
            <button 
              onClick={logout}
              className="bg-red-500 hover:bg-red-600 px-4 py-2 rounded-lg transition-colors"
            >
              Sair
            </button>
          </div>
        )}
      </div>
    </header>
  );
};

// Login Component with multiple options
const Login = () => {
  const { login, setUser } = useAuth();
  const [loginMode, setLoginMode] = useState('options'); // options, email, phone, register
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  });
  const [verificationCode, setVerificationCode] = useState('');
  const [showVerification, setShowVerification] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [demoCode, setDemoCode] = useState('');

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password
        })
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('session_token', data.session_id);
        localStorage.setItem('user_data', JSON.stringify(data.user));
        setUser(data.user);
      } else {
        setMessage(data.detail || 'Erro no login');
      }
    } catch (error) {
      setMessage('Erro de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          phone: formData.phone,
          password: formData.password
        })
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('session_token', data.session_id);
        localStorage.setItem('user_data', JSON.stringify(data.user));
        setUser(data.user);
      } else {
        setMessage(data.detail || 'Erro no login');
      }
    } catch (error) {
      setMessage('Erro de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    if (formData.password !== formData.confirmPassword) {
      setMessage('Senhas não coincidem');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email || null,
          phone: formData.phone || null,
          password: formData.password
        })
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('session_token', data.session_id);
        localStorage.setItem('user_data', JSON.stringify(data.user));
        setUser(data.user);
      } else {
        setMessage(data.detail || 'Erro no registro');
      }
    } catch (error) {
      setMessage('Erro de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const sendVerificationCode = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/send-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          phone: formData.phone
        })
      });

      const data = await response.json();
      if (response.ok) {
        setShowVerification(true);
        setDemoCode(data.demo_code); // For demo purposes
        setMessage('Código enviado por SMS!');
      } else {
        setMessage(data.detail || 'Erro ao enviar código');
      }
    } catch (error) {
      setMessage('Erro de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/verify-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          phone: formData.phone,
          code: verificationCode
        })
      });

      const data = await response.json();
      if (response.ok) {
        setMessage('Telefone verificado com sucesso!');
        setShowVerification(false);
      } else {
        setMessage(data.detail || 'Código inválido');
      }
    } catch (error) {
      setMessage('Erro de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const renderLoginOptions = () => (
    <div className="space-y-4">
      <div className="text-center mb-8">
        <div className="text-6xl mb-4">💰</div>
        <h1 className="text-3xl font-bold text-gray-800 mb-2">ClickEarn Pro</h1>
        <p className="text-gray-600">Escolha como deseja entrar</p>
      </div>

      <button 
        onClick={login}
        className="w-full bg-gradient-to-r from-red-500 to-red-600 text-white py-3 rounded-lg font-semibold hover:from-red-600 hover:to-red-700 transition-all transform hover:scale-105 flex items-center justify-center space-x-2"
      >
        <span>🔐</span>
        <span>Entrar com Google</span>
      </button>

      <div className="flex space-x-2">
        <button 
          onClick={() => setLoginMode('email')}
          className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 text-white py-3 rounded-lg font-semibold hover:from-blue-600 hover:to-blue-700 transition-all"
        >
          📧 Email
        </button>
        <button 
          onClick={() => setLoginMode('phone')}
          className="flex-1 bg-gradient-to-r from-green-500 to-green-600 text-white py-3 rounded-lg font-semibold hover:from-green-600 hover:to-green-700 transition-all"
        >
          📱 Telefone
        </button>
      </div>

      <button 
        onClick={() => setLoginMode('register')}
        className="w-full bg-gradient-to-r from-purple-500 to-purple-600 text-white py-3 rounded-lg font-semibold hover:from-purple-600 hover:to-purple-700 transition-all"
      >
        ✨ Criar Conta
      </button>

      <div className="space-y-2 mt-6 text-sm text-gray-600">
        <div className="flex items-center space-x-2">
          <span>✓</span>
          <span>Ganhe $0.50 por clique válido</span>
        </div>
        <div className="flex items-center space-x-2">
          <span>✓</span>
          <span>Assista vídeos e ganhe $0.25</span>
        </div>
        <div className="flex items-center space-x-2">
          <span>✓</span>
          <span>Saque mínimo de $10.00</span>
        </div>
      </div>
    </div>
  );

  const renderEmailLogin = () => (
    <div className="space-y-4">
      <div className="flex items-center mb-6">
        <button 
          onClick={() => setLoginMode('options')}
          className="mr-4 text-gray-600 hover:text-gray-800"
        >
          ← Voltar
        </button>
        <h2 className="text-2xl font-bold text-gray-800">Login com Email</h2>
      </div>

      <form onSubmit={handleEmailLogin} className="space-y-4">
        <input
          type="email"
          name="email"
          placeholder="Seu email"
          value={formData.email}
          onChange={handleInputChange}
          className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
        <input
          type="password"
          name="password"
          placeholder="Sua senha"
          value={formData.password}
          onChange={handleInputChange}
          className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
        <button 
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all"
        >
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </div>
  );

  const renderPhoneLogin = () => (
    <div className="space-y-4">
      <div className="flex items-center mb-6">
        <button 
          onClick={() => setLoginMode('options')}
          className="mr-4 text-gray-600 hover:text-gray-800"
        >
          ← Voltar
        </button>
        <h2 className="text-2xl font-bold text-gray-800">Login com Telefone</h2>
      </div>

      {!showVerification ? (
        <form onSubmit={handlePhoneLogin} className="space-y-4">
          <input
            type="tel"
            name="phone"
            placeholder="+55 11 99999-9999"
            value={formData.phone}
            onChange={handleInputChange}
            className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            required
          />
          <input
            type="password"
            name="password"
            placeholder="Sua senha"
            value={formData.password}
            onChange={handleInputChange}
            className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            required
          />
          <div className="flex space-x-2">
            <button 
              type="submit"
              disabled={loading}
              className="flex-1 bg-gradient-to-r from-green-600 to-blue-600 text-white py-3 rounded-lg font-semibold hover:from-green-700 hover:to-blue-700 transition-all"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
            <button 
              type="button"
              onClick={sendVerificationCode}
              disabled={loading || !formData.phone}
              className="px-4 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-semibold transition-all"
            >
              Verificar
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          <p className="text-gray-600">Código enviado para {formData.phone}</p>
          {demoCode && (
            <p className="text-green-600 font-semibold">Demo: {demoCode}</p>
          )}
          <input
            type="text"
            placeholder="Código de 6 dígitos"
            value={verificationCode}
            onChange={(e) => setVerificationCode(e.target.value)}
            className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            maxLength="6"
          />
          <button 
            onClick={verifyCode}
            disabled={loading}
            className="w-full bg-gradient-to-r from-green-600 to-blue-600 text-white py-3 rounded-lg font-semibold hover:from-green-700 hover:to-blue-700 transition-all"
          >
            {loading ? 'Verificando...' : 'Verificar Código'}
          </button>
        </div>
      )}
    </div>
  );

  const renderRegister = () => (
    <div className="space-y-4">
      <div className="flex items-center mb-6">
        <button 
          onClick={() => setLoginMode('options')}
          className="mr-4 text-gray-600 hover:text-gray-800"
        >
          ← Voltar
        </button>
        <h2 className="text-2xl font-bold text-gray-800">Criar Conta</h2>
      </div>

      <form onSubmit={handleRegister} className="space-y-4">
        <input
          type="text"
          name="name"
          placeholder="Seu nome completo"
          value={formData.name}
          onChange={handleInputChange}
          className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          required
        />
        <input
          type="email"
          name="email"
          placeholder="Seu email (opcional)"
          value={formData.email}
          onChange={handleInputChange}
          className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        <input
          type="tel"
          name="phone"
          placeholder="Seu telefone (opcional)"
          value={formData.phone}
          onChange={handleInputChange}
          className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        <input
          type="password"
          name="password"
          placeholder="Criar senha"
          value={formData.password}
          onChange={handleInputChange}
          className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          required
        />
        <input
          type="password"
          name="confirmPassword"
          placeholder="Confirmar senha"
          value={formData.confirmPassword}
          onChange={handleInputChange}
          className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          required
        />
        <p className="text-sm text-gray-600">
          * Pelo menos um email ou telefone é obrigatório
        </p>
        <button 
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 transition-all"
        >
          {loading ? 'Criando conta...' : 'Criar Conta'}
        </button>
      </form>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4">
        {message && (
          <div className={`p-4 rounded-lg mb-4 ${message.includes('Erro') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
            {message}
          </div>
        )}

        {loginMode === 'options' && renderLoginOptions()}
        {loginMode === 'email' && renderEmailLogin()}
        {loginMode === 'phone' && renderPhoneLogin()}
        {loginMode === 'register' && renderRegister()}
      </div>
    </div>
  );
};

// Dashboard Stats Component
const DashboardStats = ({ dashboard }) => {
  return (
    <div className="grid md:grid-cols-5 gap-6 mb-8">
      <div className="bg-gradient-to-r from-green-400 to-green-600 text-white rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-green-100">Saldo Atual</p>
            <p className="text-2xl font-bold">${dashboard.balance.toFixed(2)}</p>
          </div>
          <div className="text-3xl">💳</div>
        </div>
      </div>
      
      <div className="bg-gradient-to-r from-blue-400 to-blue-600 text-white rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-blue-100">Total Ganho</p>
            <p className="text-2xl font-bold">${dashboard.total_earned.toFixed(2)}</p>
          </div>
          <div className="text-3xl">💰</div>
        </div>
      </div>
      
      <div className="bg-gradient-to-r from-purple-400 to-purple-600 text-white rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-purple-100">Cliques Hoje</p>
            <p className="text-2xl font-bold">{dashboard.clicks_today}/20</p>
          </div>
          <div className="text-3xl">👆</div>
        </div>
      </div>
      
      <div className="bg-gradient-to-r from-red-400 to-red-600 text-white rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-red-100">Vídeos Hoje</p>
            <p className="text-2xl font-bold">{dashboard.videos_today}/10</p>
          </div>
          <div className="text-3xl">🎬</div>
        </div>
      </div>
      
      <div className="bg-gradient-to-r from-orange-400 to-orange-600 text-white rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-orange-100">Ganhos Hoje</p>
            <p className="text-2xl font-bold">${dashboard.today_earnings.toFixed(2)}</p>
          </div>
          <div className="text-3xl">📈</div>
        </div>
      </div>
    </div>
  );
};

// Video Ads Component
const VideoAdsSection = ({ dashboard, onVideoComplete }) => {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [watchingVideo, setWatchingVideo] = useState(null);
  const [watchDuration, setWatchDuration] = useState(0);

  useEffect(() => {
    fetchVideos();
  }, []);

  useEffect(() => {
    let interval;
    if (watchingVideo) {
      interval = setInterval(() => {
        setWatchDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [watchingVideo]);

  const fetchVideos = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/videos`);
      const data = await response.json();
      setVideos(data.videos);
    } catch (error) {
      console.error('Erro ao carregar vídeos:', error);
    } finally {
      setLoading(false);
    }
  };

  const startWatching = (video) => {
    setWatchingVideo(video);
    setWatchDuration(0);
  };

  const stopWatching = async () => {
    if (watchingVideo && watchDuration >= 30) {
      try {
        const sessionToken = localStorage.getItem('session_token');
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/video/complete`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-ID': sessionToken
          },
          body: JSON.stringify({
            video_id: watchingVideo.id,
            watch_duration: watchDuration
          })
        });

        const data = await response.json();
        if (response.ok) {
          onVideoComplete(data.message);
        }
      } catch (error) {
        console.error('Erro ao completar vídeo:', error);
      }
    }
    setWatchingVideo(null);
    setWatchDuration(0);
  };

  if (loading) {
    return <div className="text-center py-8">Carregando vídeos...</div>;
  }

  if (watchingVideo) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
        <div className="text-center">
          <h3 className="text-xl font-bold mb-4">{watchingVideo.title}</h3>
          <div className="bg-black rounded-lg p-8 mb-4">
            <img 
              src={watchingVideo.thumbnail}
              alt={watchingVideo.title}
              className="w-full max-w-md mx-auto rounded"
            />
          </div>
          <div className="flex items-center justify-center space-x-4 mb-4">
            <span className="text-lg">⏱️ {watchDuration}s / {watchingVideo.duration}s</span>
            <div className="w-64 bg-gray-200 rounded-full h-2">
              <div 
                className="bg-green-500 h-2 rounded-full transition-all"
                style={{ width: `${Math.min((watchDuration / watchingVideo.duration) * 100, 100)}%` }}
              ></div>
            </div>
          </div>
          <button 
            onClick={stopWatching}
            className={`px-6 py-3 rounded-lg font-semibold transition-all ${
              watchDuration >= 30 
                ? 'bg-green-600 hover:bg-green-700 text-white' 
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {watchDuration >= 30 ? `Finalizar (+$${watchingVideo.earnings})` : `Aguarde ${30 - watchDuration}s`}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Vídeos Publicitários</h2>
        <div className="bg-red-100 text-red-800 px-4 py-2 rounded-lg">
          {dashboard.videos_remaining} vídeos restantes
        </div>
      </div>
      
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {videos.map((video) => (
          <div key={video.id} className="border rounded-xl overflow-hidden hover:shadow-lg transition-shadow">
            <img 
              src={video.thumbnail} 
              alt={video.title}
              className="w-full h-48 object-cover"
            />
            <div className="p-4">
              <h3 className="font-semibold text-gray-800 mb-2">{video.title}</h3>
              <p className="text-gray-600 text-sm mb-2">{video.description}</p>
              <p className="text-sm text-gray-500 mb-4">Duração: {video.duration}s</p>
              <div className="flex justify-between items-center">
                <span className="text-green-600 font-semibold">+${video.earnings}</span>
                <button 
                  onClick={() => startWatching(video)}
                  disabled={dashboard.videos_remaining <= 0}
                  className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                    dashboard.videos_remaining > 0 
                      ? 'bg-red-600 hover:bg-red-700 text-white hover:scale-105' 
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {dashboard.videos_remaining > 0 ? 'Assistir' : 'Limite atingido'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Content Grid Component  
const ContentGrid = ({ dashboard, onContentClick }) => {
  const [content, setContent] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchContent();
  }, []);

  const fetchContent = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/content`);
      const data = await response.json();
      setContent(data.content);
    } catch (error) {
      console.error('Erro ao carregar conteúdo:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Carregando conteúdos...</div>;
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Conteúdos para Clicar</h2>
        <div className="bg-green-100 text-green-800 px-4 py-2 rounded-lg">
          {dashboard.clicks_remaining} cliques restantes
        </div>
      </div>
      
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {content.map((item) => (
          <div key={item.id} className="border rounded-xl overflow-hidden hover:shadow-lg transition-shadow">
            <img 
              src={item.image} 
              alt={item.title}
              className="w-full h-48 object-cover"
            />
            <div className="p-4">
              <h3 className="font-semibold text-gray-800 mb-2">{item.title}</h3>
              <p className="text-gray-600 text-sm mb-4">{item.description}</p>
              <div className="flex justify-between items-center">
                <span className="text-green-600 font-semibold">+${item.earnings}</span>
                <button 
                  onClick={() => onContentClick(item.id)}
                  disabled={dashboard.clicks_remaining <= 0}
                  className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                    dashboard.clicks_remaining > 0 
                      ? 'bg-blue-600 hover:bg-blue-700 text-white hover:scale-105' 
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {dashboard.clicks_remaining > 0 ? 'Clicar' : 'Limite atingido'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Withdraw Component
const WithdrawSection = ({ dashboard, onWithdrawSuccess }) => {
  const [showForm, setShowForm] = useState(false);
  const [paypalEmail, setPaypalEmail] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleWithdraw = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const sessionToken = localStorage.getItem('session_token');
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/withdraw`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-ID': sessionToken
        },
        body: JSON.stringify({
          amount: parseFloat(amount),
          paypal_email: paypalEmail
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        setMessage(data.message);
        setShowForm(false);
        setAmount('');
        setPaypalEmail('');
        onWithdrawSuccess();
      } else {
        setMessage(data.detail || 'Erro ao processar saque');
      }
    } catch (error) {
      setMessage('Erro de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Saque</h2>
        <div className="text-lg font-semibold text-green-600">
          Saldo: ${dashboard.balance.toFixed(2)}
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-lg mb-4 ${message.includes('Erro') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
          {message}
        </div>
      )}

      {!showForm ? (
        <div className="text-center">
          <p className="text-gray-600 mb-6">Valor mínimo para saque: $10.00</p>
          <button 
            onClick={() => setShowForm(true)}
            disabled={dashboard.balance < 10}
            className={`px-8 py-3 rounded-lg font-semibold transition-all ${
              dashboard.balance >= 10 
                ? 'bg-green-600 hover:bg-green-700 text-white hover:scale-105' 
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {dashboard.balance >= 10 ? 'Solicitar Saque' : 'Saldo Insuficiente'}
          </button>
        </div>
      ) : (
        <form onSubmit={handleWithdraw} className="max-w-md mx-auto">
          <div className="mb-4">
            <label className="block text-gray-700 font-semibold mb-2">Email PayPal</label>
            <input 
              type="email"
              value={paypalEmail}
              onChange={(e) => setPaypalEmail(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          
          <div className="mb-6">
            <label className="block text-gray-700 font-semibold mb-2">Valor (USD)</label>
            <input 
              type="number"
              min="10"
              max={dashboard.balance}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          
          <div className="flex space-x-4">
            <button 
              type="submit"
              disabled={loading}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-semibold transition-colors"
            >
              {loading ? 'Processando...' : 'Confirmar Saque'}
            </button>
            <button 
              type="button"
              onClick={() => setShowForm(false)}
              className="flex-1 bg-gray-500 hover:bg-gray-600 text-white py-2 rounded-lg font-semibold transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

// Main Dashboard Component
const Dashboard = () => {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const sessionToken = localStorage.getItem('session_token');
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/dashboard`, {
        headers: {
          'X-Session-ID': sessionToken
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setDashboard(data);
      }
    } catch (error) {
      console.error('Erro ao carregar dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleContentClick = async (contentId) => {
    try {
      const sessionToken = localStorage.getItem('session_token');
      const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/click`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-ID': sessionToken
        },
        body: JSON.stringify({ content_id: contentId })
      });

      const data = await response.json();
      
      if (response.ok) {
        setMessage(data.message);
        fetchDashboard(); // Refresh dashboard
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage(data.detail || 'Erro ao processar clique');
      }
    } catch (error) {
      setMessage('Erro de conexão. Tente novamente.');
    }
  };

  const handleVideoComplete = (successMessage) => {
    setMessage(successMessage);
    fetchDashboard(); // Refresh dashboard
    setTimeout(() => setMessage(''), 3000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">💰</div>
          <p className="text-xl">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <div className="container mx-auto px-4 py-8">
        {message && (
          <div className={`p-4 rounded-lg mb-6 message-fade-in ${message.includes('Erro') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
            {message}
          </div>
        )}
        
        <DashboardStats dashboard={dashboard} />
        <VideoAdsSection dashboard={dashboard} onVideoComplete={handleVideoComplete} />
        <ContentGrid dashboard={dashboard} onContentClick={handleContentClick} />
        <WithdrawSection dashboard={dashboard} onWithdrawSuccess={fetchDashboard} />
      </div>
    </div>
  );
};

// Profile Callback Component
const ProfileCallback = () => {
  const { setUser } = useAuth();
  const [processing, setProcessing] = useState(true);

  useEffect(() => {
    const processAuth = async () => {
      try {
        // Get session ID from URL fragment
        const hash = window.location.hash.substring(1);
        const params = new URLSearchParams(hash);
        const sessionId = params.get('session_id');

        if (!sessionId) {
          throw new Error('No session ID found');
        }

        // Call backend to authenticate
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/auth/profile`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Session-ID': sessionId
          }
        });

        if (response.ok) {
          const data = await response.json();
          
          // Store auth data
          localStorage.setItem('session_token', sessionId);
          localStorage.setItem('user_data', JSON.stringify(data.user));
          
          setUser(data.user);
          
          // Redirect to dashboard
          window.location.href = '/';
        } else {
          throw new Error('Authentication failed');
        }
      } catch (error) {
        console.error('Auth error:', error);
        alert('Erro na autenticação. Tente novamente.');
        window.location.href = '/';
      }
    };

    processAuth();
  }, [setUser]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="text-6xl mb-4">🔄</div>
        <p className="text-xl">Processando login...</p>
      </div>
    </div>
  );
};

// Main App Component
const App = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">💰</div>
          <p className="text-xl">Carregando...</p>
        </div>
      </div>
    );
  }

  // Handle profile callback
  if (window.location.pathname === '/profile') {
    return <ProfileCallback />;
  }

  return user ? <Dashboard /> : <Login />;
};

// App wrapper with providers
export default function AppWrapper() {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  );
}