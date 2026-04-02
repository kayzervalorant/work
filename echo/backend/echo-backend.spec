# -*- mode: python ; coding: utf-8 -*-
"""
echo-backend.spec — Spec PyInstaller pour bundler le backend FastAPI d'Echo.

Usage (depuis le dossier backend/) :
    pyinstaller echo-backend.spec --clean

Produit : dist/echo-backend  (binaire unique autonome)
"""

from PyInstaller.utils.hooks import collect_all, collect_data_files, collect_submodules

block_cipher = None

# ---------------------------------------------------------------------------
# Collecte des dépendances qui ont des sous-modules dynamiques
# ---------------------------------------------------------------------------

chroma_datas, chroma_binaries, chroma_hiddenimports = collect_all("chromadb")
pydantic_datas, pydantic_binaries, pydantic_hiddenimports = collect_all("pydantic")

hiddenimports = [
    # uvicorn (runners et protocoles chargés dynamiquement)
    "uvicorn",
    "uvicorn.logging",
    "uvicorn.loops",
    "uvicorn.loops.auto",
    "uvicorn.loops.asyncio",
    "uvicorn.http",
    "uvicorn.http.auto",
    "uvicorn.http.h11_impl",
    "uvicorn.protocols",
    "uvicorn.protocols.http",
    "uvicorn.protocols.http.auto",
    "uvicorn.protocols.http.h11_impl",
    "uvicorn.protocols.websockets",
    "uvicorn.protocols.websockets.auto",
    "uvicorn.lifespan",
    "uvicorn.lifespan.off",
    "uvicorn.lifespan.on",
    # FastAPI / Starlette
    "fastapi",
    "starlette",
    "starlette.routing",
    "starlette.middleware",
    "starlette.middleware.cors",
    "starlette.responses",
    # pypdf
    "pypdf",
    # dotenv
    "dotenv",
    # anyio backends
    "anyio",
    "anyio._backends._asyncio",
    "anyio._backends._trio",
    # SQLite (ChromaDB l'utilise)
    "sqlite3",
    "_sqlite3",
]
hiddenimports += chroma_hiddenimports
hiddenimports += pydantic_hiddenimports

# ---------------------------------------------------------------------------
# Analyse
# ---------------------------------------------------------------------------

a = Analysis(
    ["server.py"],
    pathex=[],
    binaries=chroma_binaries + pydantic_binaries,
    datas=chroma_datas + pydantic_datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        # Exclure ce qui n'est pas nécessaire → binaire plus petit
        "tkinter",
        "matplotlib",
        "PIL",
        "numpy.tests",
        "scipy",
        "IPython",
        "jupyter",
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name="echo-backend",
    debug=False,
    bootloader_ignore_signals=False,
    strip=True,        # Supprime les symboles de debug
    upx=True,          # Compression UPX si disponible (réduit la taille)
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,     # Pas de fenêtre console en prod
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
