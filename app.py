#!/usr/bin/env python3
"""
Script de inicio para producción en Render
"""
import os
import sys

# Configurar variables de entorno antes de importar cualquier cosa
if not os.getenv('SUPABASE_URL') or not os.getenv('SUPABASE_KEY'):
    print("ERROR: Variables de entorno SUPABASE_URL y SUPABASE_KEY deben estar configuradas")
    sys.exit(1)

# Configurar puerto
port = int(os.getenv('PORT', 10000))

if __name__ == "__main__":
    import uvicorn
    from server import app

    print(f"Iniciando servidor en puerto {port}")
    uvicorn.run(
        "server:app",
        host="0.0.0.0",
        port=port,
        workers=1,  # Render maneja el balanceo de carga
        access_log=True,
        log_level="info"
    )
