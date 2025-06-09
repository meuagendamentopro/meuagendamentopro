import os
import tempfile
import requests
import pandas as pd
from tkinter import messagebox

# Nome do arquivo XLSX
XLSX_FILENAME = 'dados.xlsx'

# Configurações globais
DEBUG = True  # Definir como False em produção

def debug_print(message):
    """Função para imprimir mensagens de debug apenas quando DEBUG está ativado"""
    if DEBUG:
        print(f"[DEBUG] {message}")

def get_file_path():
    """
    Determina o melhor caminho para o arquivo XLSX.
    Tenta vários diretórios em ordem de preferência e retorna o primeiro que funciona.
    """
    # Lista de possíveis locais para o arquivo, em ordem de preferência
    possible_dirs = [
        # 1. Diretório 'files' no mesmo diretório do script
        os.path.join(os.path.dirname(os.path.abspath(__file__)), 'files'),
        # 2. Diretório 'files' no diretório atual
        os.path.join(os.getcwd(), 'files'),
        # 3. Diretório temporário do sistema
        os.path.join(tempfile.gettempdir(), 'meuagendamentopro_files'),
        # 4. Diretório raiz do usuário
        os.path.join(os.path.expanduser('~'), 'meuagendamentopro_files'),
        # 5. Diretório temporário do sistema (sem subdiretório)
        tempfile.gettempdir()
    ]
    
    # Testar cada diretório
    for dir_path in possible_dirs:
        try:
            # Tentar criar o diretório se não existir
            if not os.path.exists(dir_path):
                os.makedirs(dir_path, exist_ok=True)
                debug_print(f"Diretório criado: {dir_path}")
            
            # Verificar se podemos escrever no diretório
            test_file = os.path.join(dir_path, 'test_write.tmp')
            with open(test_file, 'w') as f:
                f.write('test')
            
            # Se chegou aqui, podemos escrever no diretório
            os.remove(test_file)
            debug_print(f"Diretório com permissão de escrita: {dir_path}")
            
            # Retornar o caminho completo para o arquivo XLSX
            return os.path.join(dir_path, XLSX_FILENAME)
            
        except Exception as e:
            debug_print(f"Erro ao usar diretório {dir_path}: {str(e)}")
    
    # Se nenhum diretório funcionar, retornar um caminho no diretório temporário
    last_resort = os.path.join(tempfile.gettempdir(), XLSX_FILENAME)
    debug_print(f"Usando caminho de último recurso: {last_resort}")
    return last_resort

def download_xlsx_from_server(session=None, file_urls=None):
    """
    Baixa o arquivo XLSX do servidor.
    
    Args:
        session: Sessão de requests para fazer o download (opcional)
        file_urls: Lista de URLs para tentar baixar o arquivo (opcional)
    
    Returns:
        tuple: (sucesso, caminho_do_arquivo)
    """
    if file_urls is None:
        file_urls = [
            'https://meuagendamentopro.com.br/api/files',
            'https://meuagendamentopro.com.br/files',
            'https://meuagendamentopro.com.br/public/files',
            'https://meuagendamentopro.com.br/download',
            'https://meuagendamentopro.com.br/data'
        ]
    
    # Obter o melhor caminho para o arquivo
    file_path = get_file_path()
    debug_print(f"Caminho do arquivo para download: {file_path}")
    
    # Tentar baixar o arquivo de várias URLs diferentes
    for base_url in file_urls:
        # Tentar caminho direto
        try:
            download_url = f"{base_url}/{XLSX_FILENAME}"
            debug_print(f"Tentando baixar arquivo de: {download_url}")
            
            # Se temos uma sessão autenticada, usamos ela para fazer o download
            if session:
                response = session.get(download_url, stream=True)
            else:
                # Caso contrário, criamos uma nova sessão
                response = requests.get(download_url, stream=True)
            
            # Verificar se a resposta foi bem-sucedida
            response.raise_for_status()
            
            # Salvar o arquivo localmente
            try:
                with open(file_path, 'wb') as f:
                    for chunk in response.iter_content(chunk_size=8192):
                        f.write(chunk)
                
                debug_print(f"Arquivo baixado com sucesso para: {file_path}")
                return True, file_path
            except Exception as write_error:
                debug_print(f"Erro ao escrever arquivo: {str(write_error)}")
                # Tentar um caminho alternativo
                try:
                    temp_path = os.path.join(tempfile.gettempdir(), XLSX_FILENAME)
                    debug_print(f"Tentando salvar em caminho alternativo: {temp_path}")
                    
                    with open(temp_path, 'wb') as f:
                        for chunk in response.iter_content(chunk_size=8192):
                            f.write(chunk)
                    
                    debug_print(f"Arquivo salvo em caminho alternativo: {temp_path}")
                    return True, temp_path
                except Exception as temp_error:
                    debug_print(f"Erro ao salvar em caminho alternativo: {str(temp_error)}")
        except Exception as e:
            debug_print(f"Erro ao baixar arquivo de {download_url}: {str(e)}")
        
        # Tentar caminho com /download/
        try:
            download_url = f"{base_url}/download/{XLSX_FILENAME}"
            debug_print(f"Tentando caminho alternativo: {download_url}")
            
            if session:
                response = session.get(download_url, stream=True)
            else:
                response = requests.get(download_url, stream=True)
            
            response.raise_for_status()
            
            try:
                with open(file_path, 'wb') as f:
                    for chunk in response.iter_content(chunk_size=8192):
                        f.write(chunk)
                
                debug_print(f"Arquivo baixado com sucesso (caminho alternativo) para: {file_path}")
                return True, file_path
            except Exception as write_error:
                debug_print(f"Erro ao escrever arquivo (caminho alternativo): {str(write_error)}")
                # Tentar um caminho alternativo
                try:
                    temp_path = os.path.join(tempfile.gettempdir(), XLSX_FILENAME)
                    debug_print(f"Tentando salvar em caminho alternativo: {temp_path}")
                    
                    with open(temp_path, 'wb') as f:
                        for chunk in response.iter_content(chunk_size=8192):
                            f.write(chunk)
                    
                    debug_print(f"Arquivo salvo em caminho alternativo: {temp_path}")
                    return True, temp_path
                except Exception as temp_error:
                    debug_print(f"Erro ao salvar em caminho alternativo: {str(temp_error)}")
        except Exception as alt_e:
            debug_print(f"Erro ao baixar arquivo de {download_url}: {str(alt_e)}")
    
    # Se todas as tentativas falharem, criar um arquivo local com dados básicos
    debug_print("Todas as tentativas de download falharam. Criando arquivo local com dados básicos.")
    try:
        # Criar um DataFrame com algumas colunas básicas
        df = pd.DataFrame({
            'Código': [1, 2, 3],
            'Produto': ['Produto A', 'Produto B', 'Produto C'],
            'Preço': [100.0, 200.0, 300.0],
            'Estoque': [10, 20, 30],
            'Categoria': ['Categoria 1', 'Categoria 2', 'Categoria 3']
        })
        
        # Tentar salvar como arquivo XLSX no caminho original
        try:
            df.to_excel(file_path, index=False)
            debug_print(f"Arquivo local criado com sucesso: {file_path}")
            messagebox.showinfo('Arquivo Local', 'Não foi possível baixar o arquivo do servidor. Um arquivo local com dados básicos foi criado.')
            return True, file_path
        except Exception as excel_error:
            debug_print(f"Erro ao criar arquivo local no caminho original: {str(excel_error)}")
            # Tentar salvar em um diretório temporário
            try:
                temp_path = os.path.join(tempfile.gettempdir(), XLSX_FILENAME)
                df.to_excel(temp_path, index=False)
                debug_print(f"Arquivo local criado em caminho alternativo: {temp_path}")
                messagebox.showinfo('Arquivo Local', 'Não foi possível baixar o arquivo do servidor. Um arquivo local com dados básicos foi criado.')
                return True, temp_path
            except Exception as temp_excel_error:
                debug_print(f"Erro ao criar arquivo local em caminho alternativo: {str(temp_excel_error)}")
                return False, None
    except Exception as e:
        debug_print(f"Erro ao criar arquivo local: {str(e)}")
        return False, None
