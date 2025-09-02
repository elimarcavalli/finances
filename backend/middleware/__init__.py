# middleware/__init__.py

"""
Middleware package para o sistema de finanças.
Contém middlewares de autenticação, error handling e outras funcionalidades transversais.
"""

from .auth import get_current_user, create_access_token, get_current_user_optional
from .error_handler import ErrorHandlerMiddleware

__all__ = [
    'get_current_user',
    'get_current_user_optional', 
    'create_access_token',
    'ErrorHandlerMiddleware'
]