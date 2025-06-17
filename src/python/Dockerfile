# Use uma imagem oficial do Python como imagem base
FROM python:3.9-slim

# Instale dependências do sistema para o pyodbc e o driver ODBC do SQL Server
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    unixodbc-dev \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Baixar e instalar o ODBC Driver 17 para SQL Server
RUN curl https://packages.microsoft.com/keys/microsoft.asc | tee /etc/apt/trusted.gpg.d/microsoft.asc.asc
RUN curl https://packages.microsoft.com/config/debian/10/prod.list | tee /etc/apt/sources.list.d/mssql-release.list
RUN apt-get update \
    && ACCEPT_EULA=Y apt-get install -y msodbcsql17 \
    && apt-get clean

# Defina o diretório de trabalho dentro do container
WORKDIR /app

# Copie os arquivos do diretório atual para o diretório de trabalho no container
COPY . /app

# Instale as dependências do projeto (incluso o pyodbc no requirements.txt)
RUN pip install --no-cache-dir -r requirements.txt

# Exponha a porta que o Flask usará
EXPOSE 5000

# Defina o comando para iniciar a aplicação Flask
CMD ["python", "app.py"]
