import { useState } from 'react';
import { api } from '../api';

function AdminLogin({ onLoginSuccess, onLogout }) {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await api.login(formData.username, formData.password);

      if (result.success) {
        onLoginSuccess();
      } else {
        setError(result.message || 'Credenciais inválidas');
      }
    } catch (err) {
      setError('Erro ao fazer login. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div className="admin-login">
      <div className="login-container">
        <div className="login-header">
          <h1>Admin - Doce Maná</h1>
          <p>Acesse o painel administrativo</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="username">Usuário</label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder="Seu usuário"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Senha</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Sua senha"
              required
              disabled={loading}
            />
          </div>

          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}

          <button
            type="submit"
            className="button button-primary"
            disabled={loading}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div className="login-tips">
          <h4>Dicas</h4>
          <ul>
            <li>Usuário padrão: <strong>admin</strong></li>
            <li>Senha padrão: <strong>admin123</strong></li>
            <li>Você pode alterar essas credenciais no painel</li>
          </ul>
        </div>
      </div>

      <button
        className="logout-button"
        onClick={onLogout}
        aria-label="Sair do painel administrativo"
      >
        Sair do painel
      </button>
    </div>
  );
}

export default AdminLogin;