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

// Login Component
const Login = () => {
  const { login } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">💰</div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">ClickEarn Pro</h1>
          <p className="text-gray-600">Ganhe dinheiro clicando em conteúdos</p>
        </div>
        
        <div className="space-y-4 mb-8">
          <div className="flex items-center space-x-3 text-green-600">
            <span>✓</span>
            <span>Ganhe $0.50 por clique válido</span>
          </div>
          <div className="flex items-center space-x-3 text-green-600">
            <span>✓</span>
            <span>Limite de 20 cliques por dia</span>
          </div>
          <div className="flex items-center space-x-3 text-green-600">
            <span>✓</span>
            <span>Saque mínimo de $10.00</span>
          </div>
          <div className="flex items-center space-x-3 text-green-600">
            <span>✓</span>
            <span>Pagamentos via PayPal</span>
          </div>
        </div>
        
        <button 
          onClick={login}
          className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all transform hover:scale-105"
        >
          Entrar com Google
        </button>
      </div>
    </div>
  );
};

// Dashboard Stats Component
const DashboardStats = ({ dashboard }) => {
  return (
    <div className="grid md:grid-cols-4 gap-6 mb-8">
      <div className="bg-gradient-to-r from-green-400 to-green-600 text-white rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-green-100">Saldo Atual</p>
            <p className="text-3xl font-bold">${dashboard.balance.toFixed(2)}</p>
          </div>
          <div className="text-4xl">💳</div>
        </div>
      </div>
      
      <div className="bg-gradient-to-r from-blue-400 to-blue-600 text-white rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-blue-100">Total Ganho</p>
            <p className="text-3xl font-bold">${dashboard.total_earned.toFixed(2)}</p>
          </div>
          <div className="text-4xl">💰</div>
        </div>
      </div>
      
      <div className="bg-gradient-to-r from-purple-400 to-purple-600 text-white rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-purple-100">Cliques Hoje</p>
            <p className="text-3xl font-bold">{dashboard.clicks_today}/20</p>
          </div>
          <div className="text-4xl">👆</div>
        </div>
      </div>
      
      <div className="bg-gradient-to-r from-orange-400 to-orange-600 text-white rounded-xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-orange-100">Ganhos Hoje</p>
            <p className="text-3xl font-bold">${dashboard.today_earnings.toFixed(2)}</p>
          </div>
          <div className="text-4xl">📈</div>
        </div>
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
          <div className={`p-4 rounded-lg mb-6 ${message.includes('Erro') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
            {message}
          </div>
        )}
        
        <DashboardStats dashboard={dashboard} />
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