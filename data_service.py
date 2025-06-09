import requests
import pandas as pd
import io
import os
import sys
from tkinter import messagebox

# Configurações globais
DEBUG = True  # Definir como False em produção

def debug_print(message):
    """Função para imprimir mensagens de debug apenas quando DEBUG está ativado"""
    if DEBUG:
        print(f"[DEBUG] {message}")

class DataService:
    """Serviço para acessar dados do arquivo local ou do servidor"""
    
    def __init__(self, session=None, base_url='https://meuagendamentopro.com.br/api'):
        self.session = session
        self.base_url = base_url
        
        # Obter o caminho base do aplicativo
        self.app_path = os.path.dirname(os.path.abspath(__file__))
        # Caminho para a pasta files
        self.files_dir = os.path.join(self.app_path, 'files')
        debug_print(f"Diretório de arquivos: {self.files_dir}")
        
    def get_data(self, filename='dados.xlsx'):
        """
        Obtém os dados do arquivo local ou do servidor.
        
        Args:
            filename: Nome do arquivo a ser acessado
            
        Returns:
            DataFrame: Dados do arquivo XLSX como DataFrame do pandas
        """
        # Primeiro, tentar ler o arquivo local
        local_file_path = os.path.join(self.files_dir, filename)
        debug_print(f"Verificando arquivo local: {local_file_path}")
        
        if os.path.exists(local_file_path):
            debug_print(f"Arquivo encontrado localmente: {local_file_path}")
            try:
                # Tentar ler o arquivo com diferentes engines
                try:
                    df = pd.read_excel(local_file_path, engine='openpyxl')
                    debug_print(f"Arquivo lido com sucesso usando openpyxl: {len(df)} registros")
                    return df
                except Exception as e:
                    debug_print(f"Erro ao ler com openpyxl: {str(e)}")
                    try:
                        df = pd.read_excel(local_file_path, engine='xlrd')
                        debug_print(f"Arquivo lido com sucesso usando xlrd: {len(df)} registros")
                        return df
                    except Exception as e2:
                        debug_print(f"Erro ao ler com xlrd: {str(e2)}")
                        raise Exception(f"Não foi possível ler o arquivo: {str(e2)}")
            except Exception as e:
                debug_print(f"Erro ao ler arquivo local: {str(e)}")
                # Se falhar localmente, criar dados básicos
                return self._create_basic_data()
        else:
            debug_print(f"Arquivo não encontrado localmente. Criando dados básicos.")
            return self._create_basic_data()
    
    # Método removido, não é mais necessário
    
    def _create_basic_data(self):
        """Cria um DataFrame básico quando não é possível acessar os dados do servidor"""
        try:
            df = pd.DataFrame({
                'Código': [1, 2, 3],
                'Produto': ['Produto A', 'Produto B', 'Produto C'],
                'Preço': [100.0, 200.0, 300.0],
                'Estoque': [10, 20, 30],
                'Categoria': ['Categoria 1', 'Categoria 2', 'Categoria 3']
            })
            debug_print("Dados básicos criados com sucesso")
            messagebox.showinfo('Dados Locais', 'Não foi possível acessar os dados do servidor. Usando dados básicos para demonstração.')
            return df
        except Exception as e:
            debug_print(f"Erro ao criar dados básicos: {str(e)}")
            # Retornar DataFrame vazio como último recurso
            return pd.DataFrame()
