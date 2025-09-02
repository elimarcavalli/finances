# middleware/auth.py

"""
Middleware de autenticação que funciona como um wrapper/proxy para o auth_service.
Centraliza a lógica de autenticação em um local consistente para todos os módulos.
"""

from fastapi import Depends, HTTPException, status
from services.auth_service import get_current_user as _get_current_user
from services.auth_service import create_access_token as _create_access_token
from services.auth_service import verify_password, get_password_hash, SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES
from services.database_service import DatabaseService
import logging

logger = logging.getLogger(__name__)

# Re-exportar as funções principais do auth_service para manter compatibilidade
create_access_token = _create_access_token

async def get_current_user(token_data = Depends(_get_current_user)):
    """
    Wrapper para get_current_user que adiciona busca no banco de dados.
    Retorna dados completos do usuário incluindo user_id.
    """
    try:
        # O auth_service já validou o token e retornou o username
        username = token_data.get("username")
        
        if not username:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token inválido: username não encontrado",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Buscar dados completos do usuário no banco
        db_service = DatabaseService()
        db_service.ensure_connection()
        cursor = db_service.connection.cursor(dictionary=True)
        
        try:
            query = "SELECT id as user_id, username, email FROM users WHERE username = %s"
            cursor.execute(query, (username,))
            user = cursor.fetchone()
            
            if not user:
                logger.warning(f"User not found in database: {username}")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Usuário não encontrado",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            
            logger.info(f"Authenticated user: {username} (ID: {user['user_id']})")
            return user
            
        finally:
            cursor.close()
            
    except HTTPException:
        # Re-raise HTTPExceptions
        raise
    except Exception as e:
        logger.error(f"Error in get_current_user: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Erro na autenticação do usuário",
            headers={"WWW-Authenticate": "Bearer"},
        )

async def get_current_user_optional(token_data = Depends(_get_current_user)):
    """
    Versão opcional do get_current_user que não levanta exceção se não autenticado.
    Retorna None se não houver token válido.
    """
    try:
        return await get_current_user(token_data)
    except HTTPException:
        return None

def require_admin(current_user: dict = Depends(get_current_user)):
    """
    Dependência que requer que o usuário seja admin.
    """
    # Por enquanto, todos os usuários são considerados admin
    # Em um sistema real, verificaríamos roles no banco de dados
    return current_user

def require_permissions(permissions: list):
    """
    Factory function para criar dependências que requerem permissões específicas.
    """
    def permission_checker(current_user: dict = Depends(get_current_user)):
        # Por enquanto, todos os usuários têm todas as permissões
        # Em um sistema real, verificaríamos permissões no banco de dados
        return current_user
    
    return permission_checker

# Configurações exportadas para uso em outros módulos
__all__ = [
    'get_current_user',
    'get_current_user_optional', 
    'create_access_token',
    'require_admin',
    'require_permissions',
    'verify_password',
    'get_password_hash',
    'SECRET_KEY',
    'ALGORITHM',
    'ACCESS_TOKEN_EXPIRE_MINUTES'
]