# Backend - Doce Maná

Servidor Node.js/Express para aplicação Doce Maná.

## Dependências

```bash
cd backend
npm install
```

## Configuração

Criar arquivo `.env` na raiz do backend:
```
PORT=3001
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
```

## Scripts

```bash
# Inicializar banco de dados
npm run init-db

# Desenvolvimento (com reload)
npm run dev

# Produção
npm start
```