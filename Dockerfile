FROM python:3.11-alpine

WORKDIR /app

# Instalar dependências do sistema
RUN apk add --no-cache bash docker-cli

# Copiar requirements
COPY requirements.txt .

# Instalar dependências Python
RUN pip install --no-cache-dir -r requirements.txt

# Copiar aplicação
COPY app.py .
COPY templates/ templates/
COPY static/ static/
COPY stacks/ stacks/

# Expor porta
EXPOSE 5000

# Comando para iniciar a aplicação
CMD ["python", "app.py"]
