from fastapi import FastAPI, HTTPException, Depends, Header, status, File, UploadFile
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import json
from db.conn import SQLServerConnection
import os
import redis  # Importa a biblioteca Redis
import jwt
from typing import Optional
from datetime import datetime
from couchdb_util import salvar_no_couchdb, manage_documents
import requests
from PIL import Image
import hashlib
import io
from deepface import DeepFace
import numpy as np
import cv2
import tempfile

# Instanciando o aplicativo FastAPI
app = FastAPI()

# region Funções de Utilitário e Comparação de Rostos

cache_memoria = {}

def gerar_hash_imagem(imagem_data):
    """Gera um hash SHA256 para os dados de uma imagem."""
    hasher = hashlib.sha256()
    hasher.update(imagem_data)
    return hasher.hexdigest()

def allowed_file(filename: str) -> bool:
    """Verifica se a extensão do arquivo é permitida."""
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg'}
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def comparar_rostos_com_arquivos(imagem_data1, imagem_data2, modelo='Facenet'):
    """
    Compara dois rostos usando DeepFace.verify.
    Salva temporariamente as imagens para que DeepFace possa acessá-las.
    """
    try:
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=True) as temp1, \
             tempfile.NamedTemporaryFile(suffix=".jpg", delete=True) as temp2:
            
            temp1.write(imagem_data1)
            temp1.flush() # Garante que os dados sejam gravados no disco
            
            temp2.write(imagem_data2)
            temp2.flush() # Garante que os dados sejam gravados no disco

            resultado = DeepFace.verify(
                img1_path=temp1.name,
                img2_path=temp2.name,
                model_name=modelo,
                enforce_detection=True # Garante que um rosto seja detectado
            )

            return {
                "mesma_pessoa": resultado["verified"],
                "distancia": float(resultado["distance"]), # Convertido para float nativo do Python
                "modelo_usado": resultado["model"],
                "similaridade_percentual": round((1 - float(resultado["distance"])) * 100, 2) # Convertido para float nativo
            }

    except Exception as e:
        # Captura exceções específicas de DeepFace, como "no face detected"
        if "Face could not be detected in" in str(e):
            return {"erro": f"Erro: {e}. Certifique-se de que as imagens contêm rostos claros."}
        return {"erro": f"Erro inesperado ao comparar rostos com DeepFace: {e}"}

@app.get("/")
async def hello_world():
    """Endpoint de teste simples."""
    return {"mensagem": "Olá, mundo!"}

@app.post("/compare")
async def compare_faces(imagem1: UploadFile = File(...), imagem2: UploadFile = File(...)):
    """
    Endpoint para comparar dois rostos e verificar se são a mesma pessoa.
    """
    # Validação de tipo de arquivo para ambas as imagens
    if not allowed_file(imagem1.filename):
        raise HTTPException(status_code=400, detail="Apenas arquivos PNG, JPG ou JPEG são permitidos para a Imagem 1.")
    if not allowed_file(imagem2.filename):
        raise HTTPException(status_code=400, detail="Apenas arquivos PNG, JPG ou JPEG são permitidos para a Imagem 2.")

    try:
        dados_imagem1 = await imagem1.read()
        dados_imagem2 = await imagem2.read()

        hash1 = gerar_hash_imagem(dados_imagem1)
        hash2 = gerar_hash_imagem(dados_imagem2)

        # Armazena em cache (para demonstração)
        cache_memoria['imagem1_compare'] = {'dados': dados_imagem1, 'hash': hash1}
        cache_memoria['imagem2_compare'] = {'dados': dados_imagem2, 'hash': hash2}

        # Realiza a comparação de rostos
        resultado_comparacao = comparar_rostos_com_arquivos(dados_imagem1, dados_imagem2)

        if "erro" in resultado_comparacao:
            raise HTTPException(status_code=400, detail=resultado_comparacao["erro"])

        response_content = {
            "mensagem": "Comparação de rostos realizada com sucesso!",
            "hash_imagem1": hash1,
            "hash_imagem2": hash2,
            "comparacao_rostos": resultado_comparacao # Dados da comparação entre imagem 1 e 2
        }

        return JSONResponse(status_code=200, content=response_content)

    except HTTPException as http_exc:
        # Re-lança HTTPException para que o FastAPI as trate
        raise http_exc
    except Exception as e:
        # Captura qualquer outra exceção inesperada
        raise HTTPException(status_code=500, detail=f"Erro interno do servidor ao comparar rostos: {str(e)}")


# API Endpoint para Análise de Idade e Gênero
@app.post("/gender")
async def analyze_gender_age(imagem: UploadFile = File(...)):
    """
    Endpoint para analisar a idade e o gênero estimados de uma pessoa em uma imagem.
    """
    # Validação de tipo de arquivo
    if not allowed_file(imagem.filename):
        raise HTTPException(status_code=400, detail="Apenas arquivos PNG, JPG ou JPEG são permitidos.")

    try:
        dados_imagem = await imagem.read()
        hash_imagem = gerar_hash_imagem(dados_imagem)

        # Armazena em cache (para demonstração)
        cache_memoria['imagem_gender_age'] = {'dados': dados_imagem, 'hash': hash_imagem}

        # --- Análise de Idade e Gênero ---
        analise_data = None
        with tempfile.NamedTemporaryFile(suffix=".jpg", delete=True) as temp_analise:
            temp_analise.write(dados_imagem)
            temp_analise.flush()

            try:
                # DeepFace.analyze retorna uma lista de dicionários, um para cada rosto detectado.
                # Usamos enforce_detection=True para garantir que um rosto seja encontrado.
                analises = DeepFace.analyze(
                    img_path=temp_analise.name,
                    actions=['age', 'gender'],
                    enforce_detection=True
                )
                
                if not analises:
                    raise HTTPException(status_code=400, detail="Nenhum rosto detectado na imagem para análise de idade/gênero.")
                
                # Pegamos os dados do primeiro rosto detectado (geralmente o mais proeminente)
                primeiro_rosto_analise = analises[0]

                # Converte as probabilidades de gênero para floats nativos do Python
                probabilidades_genero_nativas = {
                    key: float(value) for key, value in primeiro_rosto_analise["gender"].items()
                }

                analise_data = {
                    "idade_aproximada": float(primeiro_rosto_analise["age"]), # Convertido para float nativo
                    "genero_dominante": primeiro_rosto_analise["dominant_gender"],
                    "probabilidades_genero": probabilidades_genero_nativas # Dicionário com floats nativos
                }
            except Exception as e:
                # Captura erros específicos da análise (ex: "Face could not be detected")
                if "Face could not be detected in" in str(e):
                    raise HTTPException(status_code=400, detail=f"Erro na análise: {e}. Não foi possível analisar idade/gênero.")
                raise e # Re-lança outros erros

        response_content = {
            "mensagem": "Análise de idade e gênero realizada com sucesso!",
            "hash_imagem": hash_imagem,
            "analise_facial": analise_data
        }

        return JSONResponse(status_code=200, content=response_content)

    except HTTPException as http_exc:
        # Re-lança HTTPException para que o FastAPI as trate
        raise http_exc
    except Exception as e:
        # Captura qualquer outra exceção inesperada
        raise HTTPException(status_code=500, detail=f"Erro interno do servidor ao processar a imagem: {str(e)}")
# endregion


#region CRUD SQL SERVER 2008

# Configurações de conexão com o SQL Server
server = '10.2.214.33'
database = 'des_estagio'
username = 'user_all'
password = 't1c0ml8r@'

# Cria uma instância da classe SQLServerConnection.
db_connection = SQLServerConnection(server, database, username, password)

# Configurações do Redis
redis_host = os.getenv('REDIS_HOST', 'redis')  # Nome do serviço no Docker
redis_port = int(os.getenv('REDIS_PORT', 6379))
redis_client = redis.Redis(host=redis_host, port=redis_port, db=0)

# Porta do servidor
port = int(os.environ.get('PORT', 6000))

# Modelo para o corpo da requisição de inserção de bairro
class Bairro(BaseModel):
    strBairro: str


#region exemplo de CRUD SQL SERVER 2008

@app.get("/buscarTodos")
async def buscar_todos():
    """
    Endpoint para buscar todos os bairros.
    """
    # Verifica se o resultado está em cache
    cached_result = redis_client.get("bairros:todos")
    if cached_result:
        return json.loads(cached_result)  # Retorna o resultado do cache

    db_connection.open_connection()
    try:
        query = "SELECT numIdBairro, strBairro FROM [des_estagio].[dbo].[Bairro]"
        bairros = db_connection.execute_query(query)
        if bairros:
            resultado = [{"numIdBairro": row.numIdBairro, "strBairro": row.strBairro} for row in bairros]
            # Armazena o resultado no cache por 60 segundos
            redis_client.set("bairros:todos", json.dumps(resultado), ex=60)
            return resultado
        else:
            raise HTTPException(status_code=404, detail="Nenhum bairro encontrado")
    except Exception as ex:
        raise HTTPException(status_code=500, detail=str(ex))
    finally:
        db_connection.close_connection()


@app.get("/buscarPeloID/{id}")
async def buscar_pelo_id(id: int):
    """
    Endpoint para buscar um bairro pelo ID.
    """
    # Verifica se o resultado está em cache
    cached_result = redis_client.get(f"bairros:{id}")
    if cached_result:
        return json.loads(cached_result)  # Retorna o resultado do cache

    db_connection.open_connection()
    try:
        query = "SELECT numIdBairro, strBairro FROM [des_estagio].[dbo].[Bairro] WHERE numIdBairro = ?"
        bairro = db_connection.execute_query(query, (id,))
        if bairro:
            resultado = {"numIdBairro": bairro[0].numIdBairro, "strBairro": bairro[0].strBairro}
            # Armazena o resultado no cache por 60 segundos
            redis_client.set(f"bairros:{id}", json.dumps(resultado), ex=60)
            return resultado
        else:
            raise HTTPException(status_code=404, detail="Bairro não encontrado")
    except Exception as ex:
        raise HTTPException(status_code=500, detail=str(ex))
    finally:
        db_connection.close_connection()

@app.post("/InserirPeloBairro")
async def inserir_pelo_bairro(bairro: Bairro):
    """
    Endpoint para inserir um novo bairro.
    """
    if not bairro.strBairro:
        raise HTTPException(status_code=400, detail="O campo 'strBairro' é obrigatório")

    db_connection.open_connection()
    try:
        query = "INSERT INTO [des_estagio].[dbo].[Bairro] (strBairro) VALUES (?)"
        db_connection.execute_query(query, (bairro.strBairro,))
        
        # Invalida o cache de "todos os bairros"
        redis_client.delete("bairros:todos")
        
        return {"message": "Bairro inserido com sucesso"}
    except Exception as ex:
        raise HTTPException(status_code=500, detail=str(ex))
    finally:
        db_connection.close_connection()

@app.delete("/removerPeloID/{id}")
async def remover_pelo_id(id: int):
    """
    Endpoint para remover um bairro pelo ID.
    """
    db_connection.open_connection()
    try:
        query = "DELETE FROM [des_estagio].[dbo].[Bairro] WHERE numIdBairro = ?"
        db_connection.execute_query(query, (id,))
        
        # Verifica se algum registro foi removido
        if db_connection.cursor.rowcount > 0:
            # Invalida o cache de "todos os bairros" e do bairro específico
            redis_client.delete("bairros:todos")
            redis_client.delete(f"bairros:{id}")
            return {"message": "Bairro removido com sucesso total."}
        else:
            raise HTTPException(status_code=404, detail="Bairro não encontrado")
    except Exception as ex:
        raise HTTPException(status_code=500, detail=str(ex))
    finally:
        db_connection.close_connection()

#endregion exemplo de CRUD SQL SERVER 2008

#endregion

#region WEBHULK Telemetria veicular

@app.get("/")  # Define um endpoint GET na rota "/"
def ola_mundo():
    return {"mensagem": "Olá terça-feira FRIA e linda!"}


class WebhookData(BaseModel):
    lat: float
    lng: float
    placa: str

SECRET_KEY = "minha_chave_super_secreta"
ALGORITHM = "HS256"


# Função para verificar o token JWT
def verificar_token(authorization: Optional[str] = Header(None)):
    if authorization is None or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token ausente ou inválido")
    
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload  # você pode retornar informações úteis do payload, como o CNPJ
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expirado")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")

# Endpoint com token obrigatório
@app.post("/webhook")
async def receive_webhook(
    data: WebhookData,
    usuario=Depends(verificar_token)
):
    ts = datetime.now().timestamp()
    print(f"Token válido para: {usuario}")
    print(f"Recebido: LAT={data.lat}, LNG={data.lng}, PLACA={data.placa}")

    salvar_no_couchdb(data.lat, data.lng, data.placa, usuario['cnpj'], ts)
    manage_documents()

    return {
        "status": "OK",
        "lat": data.lat,
        "lng": data.lng,
        "placa": data.placa,
        "usuario": usuario['cnpj'],
        "ts": ts
    }


#endregion

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=True)



