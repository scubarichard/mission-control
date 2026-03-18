#!/bin/bash
cd /home/dkn8n/rag_api
cp .env.example .env
sed -i 's/RAG_PORT=.*/RAG_PORT=8000/' .env
sed -i 's/EMBEDDINGS_PROVIDER=.*/EMBEDDINGS_PROVIDER=openai/' .env
sed -i 's/OPENAI_API_KEY=.*/OPENAI_API_KEY=635645200b2c4f90a1833de2bda6b753/' .env
sed -i 's|OPENAI_API_BASE=.*|OPENAI_API_BASE=https://oai-dax-dakona-pilot.openai.azure.com/|' .env
sed -i 's/EMBEDDINGS_MODEL=.*/EMBEDDINGS_MODEL=text-embedding-ada-002/' .env
sed -i 's/JWT_SECRET=.*/JWT_SECRET=dax-rag-secret-2026/' .env
echo "=== ENV CHECK ==="
grep -E "RAG_PORT|EMBEDDINGS|OPENAI_API|JWT_SECRET" .env
echo "=== STARTING RAG API ==="
export PATH=$HOME/.local/bin:$PATH
pm2 start "uvicorn main:app --host 0.0.0.0 --port 8000" --name rag-api
pm2 save
echo "=== PM2 STATUS ==="
pm2 list
