import tkinter as tk
from tkinter import ttk, messagebox, font as tkfont
import pandas as pd
import requests
import os
import sys
import tempfile
from datetime import datetime

# Verificar se as dependências necessárias estão instaladas
openpyxl_installed = True
xlrd_installed = True

try:
    import openpyxl
except ImportError:
    openpyxl_installed = False
    print('AVISO: A biblioteca openpyxl não está instalada.')
    print('Tentando usar xlrd como alternativa...')

try:
    import xlrd
except ImportError:
    xlrd_installed = False
    print('AVISO: A biblioteca xlrd não está instalada.')

# Se nenhuma das bibliotecas estiver instalada, não podemos continuar
if not openpyxl_installed and not xlrd_installed:
    print('ERRO: Nenhuma biblioteca para leitura de arquivos Excel está instalada.')
    print('Por favor, instale pelo menos uma delas:')
    print('pip install openpyxl')  # Preferencial para arquivos .xlsx
    print('pip install xlrd')      # Alternativa
    sys.exit(1)

# Configurações globais
DEBUG = True  # Definir como False em produção
OFFLINE_MODE = False  # Permite usar o aplicativo sem autenticação (True = modo offline, False = requer login)

def debug_print(message):
    """Função para imprimir mensagens de debug apenas quando DEBUG está ativado"""
    if DEBUG:
        print(f"[DEBUG] {message}")

# Configure os seus endpoints aqui:
AUTH_URL = 'http://meuagendamentopro.com.br/api/login'  # Endpoint de login do sistema Meu Agendamento PRO

# Configurações do arquivo Excel
USE_REMOTE_FILE = True  # Se True, tenta baixar o arquivo do servidor
CHECK_FILE_ON_STARTUP = False  # Se False, não verifica o arquivo no início
# URL do arquivo Excel no servidor (agora usando a rota criada no servidor local)
# Temos três opções para acessar o arquivo:
# 1. Pela rota API específica: http://localhost:3003/api/dados/dados.xlsx
# 2. Pela rota alternativa: http://localhost:3003/dados.xlsx
# 3. Pelo arquivo estático na pasta public: http://localhost:3003/dados/dados.xlsx
# 
# Em produção, substitua 'localhost:3003' pelo domínio real do servidor
EXCEL_URL = 'http://meuagendamentopro.com.br/api/dados/dados.xlsx'  # URL da API específica

# Função para baixar o arquivo Excel do servidor e salvá-lo em uma pasta temporária
def download_excel_file(use_local_fallback=True):
    try:
        # Criar diretório temporário para o aplicativo se não existir
        temp_dir = tempfile.gettempdir()
        temp_app_dir = os.path.join(temp_dir, 'meuagendamentopro')
        os.makedirs(temp_app_dir, exist_ok=True)
        
        # Caminho para salvar o arquivo temporariamente
        file_path = os.path.join(temp_app_dir, 'dados.xlsx')
        
        debug_print(f"Verificando arquivo Excel do servidor: {EXCEL_URL}")
        
        try:
            # Baixar o arquivo do servidor
            response = requests.get(EXCEL_URL, stream=True, timeout=30)
            
            if response.status_code == 200:
                # Verificar se o conteúdo é realmente um arquivo Excel
                content_type = response.headers.get('Content-Type', '')
                
                # Verificar se o conteúdo é JSON (indica erro do servidor)
                if 'application/json' in content_type or response.text.strip().startswith('{'):
                    debug_print(f"Erro: O servidor retornou JSON em vez de um arquivo Excel. Resposta: {response.text[:100]}")
                    if use_local_fallback:
                        debug_print("Problema no servidor. Usando arquivo local como fallback...")
                        return use_local_file_fallback()
                    return None
                
                # Verificar tamanho mínimo do arquivo (para evitar páginas de erro HTML)
                if len(response.content) < 100:  # Arquivo Excel válido deve ser maior que isso
                    debug_print(f"Erro: O servidor retornou um arquivo muito pequeno ({len(response.content)} bytes)")
                    if use_local_fallback:
                        debug_print("Arquivo inválido. Usando arquivo local como fallback...")
                        return use_local_file_fallback()
                    return None
                
                # Salvar o arquivo no diretório temporário
                with open(file_path, 'wb') as f:
                    for chunk in response.iter_content(chunk_size=8192):
                        f.write(chunk)
                
                # Verificar se o arquivo salvo é um arquivo Excel válido
                try:
                    pd.read_excel(file_path, nrows=1)  # Tenta ler apenas a primeira linha para validar
                    debug_print(f"Arquivo Excel baixado e validado com sucesso: {file_path}")
                    return file_path
                except Exception as e:
                    debug_print(f"O arquivo baixado não é um Excel válido: {str(e)}")
                    if use_local_fallback:
                        debug_print("Arquivo inválido. Usando arquivo local como fallback...")
                        return use_local_file_fallback()
                    return None
            else:
                debug_print(f"Erro ao baixar arquivo Excel. Status code: {response.status_code}")
                if use_local_fallback:
                    debug_print("Tentando usar arquivo local como fallback...")
                    return use_local_file_fallback()
                return None
                
        except requests.exceptions.RequestException as e:
            debug_print(f"Erro de conexão ao baixar arquivo: {str(e)}")
            if use_local_fallback:
                debug_print("Tentando usar arquivo local como fallback...")
                return use_local_file_fallback()
            return None
            
    except Exception as e:
        debug_print(f"Erro inesperado ao baixar arquivo: {str(e)}")
        if use_local_fallback:
            return use_local_file_fallback()
        return None

# Função para usar arquivo local como fallback quando o servidor está indisponível
def use_local_file_fallback():
    debug_print("Tentando usar arquivo local como fallback...")
    # Verificar se existe um arquivo local na pasta files
    base_path = os.path.dirname(os.path.abspath(__file__))
    local_file_path = os.path.join(base_path, 'files', 'dados.xlsx')
    
    if os.path.exists(local_file_path):
        debug_print(f"Usando arquivo local como fallback: {local_file_path}")
        return local_file_path
    else:
        debug_print("Arquivo local de fallback não encontrado")
        return None

# Caminho para o arquivo XLSX na pasta files
def get_xlsx_file_path():
    # Primeiro tenta o caminho relativo ao script atual
    base_path = os.path.dirname(os.path.abspath(__file__))
    file_path = os.path.join(base_path, 'files', 'dados.xlsx')
    
    # Verifica se o arquivo existe localmente
    if os.path.exists(file_path):
        debug_print(f"Arquivo encontrado no caminho local: {file_path}")
        # Se não estiver configurado para usar arquivo remoto, retorna o local
        if not USE_REMOTE_FILE:
            return file_path
        # Se estiver configurado para usar remoto, verifica se deve atualizar
        elif USE_REMOTE_FILE:
            debug_print("Configurado para usar arquivo remoto, verificando atualizações...")
            # Aqui poderia verificar se o arquivo remoto é mais recente,
            # mas por simplicidade, vamos apenas retornar o local
            return file_path
    
    # Se não encontrar localmente e estiver configurado para usar remoto, tenta baixar
    if USE_REMOTE_FILE:
        debug_print("Tentando baixar arquivo do servidor...")
        downloaded_file = download_excel_file()
        if downloaded_file:
            debug_print(f"Arquivo baixado com sucesso: {downloaded_file}")
            return downloaded_file
    
    # Cria a pasta files se não existir
    try:
        files_dir = os.path.join(base_path, 'files')
        os.makedirs(files_dir, exist_ok=True)
        debug_print(f"Pasta 'files' criada/verificada em: {files_dir}")
    except Exception as e:
        debug_print(f"Erro ao criar pasta 'files': {str(e)}")
    
    # Se não conseguiu baixar ou não está configurado para remoto, retorna o caminho padrão
    debug_print("Usando caminho local padrão.")
    return file_path

# Definimos apenas o caminho padrão, mas não verificamos o arquivo ainda
# A verificação será feita após o login
base_path = os.path.dirname(os.path.abspath(__file__))
XLSX_FILE_PATH = os.path.join(base_path, 'files', 'dados.xlsx')

# Configurações globais
DEBUG = True  # Definir como False em produção
OFFLINE_MODE = False  # Permite usar o aplicativo sem autenticação (True = modo offline, False = requer login)

def debug_print(message):
    """Função para imprimir mensagens de debug apenas quando DEBUG está ativado"""
    if DEBUG:
        print(f"[DEBUG] {message}")

class LoginWindow:
    def __init__(self, master):
        self.master = master
        master.title('Login - Sistema de Verificação de Preços')
        master.geometry('350x200')
        
        # Tratamento para o evento de fechamento da janela
        master.protocol("WM_DELETE_WINDOW", self.on_closing)
        
        # Centralizar a janela na tela
        window_width = 400
        window_height = 220
        screen_width = master.winfo_screenwidth()
        screen_height = master.winfo_screenheight()
        x_coordinate = int((screen_width/2) - (window_width/2))
        y_coordinate = int((screen_height/2) - (window_height/2))
        master.geometry(f"{window_width}x{window_height}+{x_coordinate}+{y_coordinate}")
        
        # Frame principal
        main_frame = ttk.Frame(master, padding="20 20 20 20")
        main_frame.pack(fill=tk.BOTH, expand=True)
        
        # Título
        title_label = ttk.Label(main_frame, text="Realize o Login", font=("Arial", 14, "bold"))
        title_label.pack(pady=(0, 15))

        # Campos de login
        ttk.Label(main_frame, text='Usuário:').pack(anchor='w')
        self.user_entry = ttk.Entry(main_frame, width=30)
        self.user_entry.pack(fill='x', pady=(0, 10))

        ttk.Label(main_frame, text='Senha:').pack(anchor='w')
        self.pass_entry = ttk.Entry(main_frame, show='*', width=30)
        self.pass_entry.pack(fill='x', pady=(0, 15))

        # Botão de login
        btn = ttk.Button(main_frame, text='Entrar', command=self.attempt_login)
        btn.pack(fill='x')
        
        # Bind da tecla Enter
        master.bind('<Return>', lambda e: self.attempt_login())

        # Variável para armazenar a sessão do usuário
        self.session = None
        self.user_data = None

    def attempt_login(self):
        """Tenta fazer login com as credenciais fornecidas"""
        username = self.user_entry.get()
        password = self.pass_entry.get()
        
        if not username or not password:
            messagebox.showerror('Erro', 'Por favor, preencha todos os campos.')
            return
        
        debug_print(f"Tentando login com usuário: {username}")
        debug_print(f"Endpoint de autenticação: {AUTH_URL}")
        
        # Criar uma sessão para manter cookies
        self.session = requests.Session()
        
        # Preparar dados e cabeçalhos
        login_data = {
            'username': username,
            'password': password
        }
        
        # Armazenar as credenciais para verificação de status posterior
        self.credentials = {
            'username': username,
            'password': password
        }
        
        headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
        
        try:
            debug_print(f"Enviando requisição para: {AUTH_URL}")
            response = self.session.post(AUTH_URL, json=login_data, headers=headers)
            
            debug_print(f"Status da resposta: {response.status_code}")
            debug_print(f"Headers da resposta: {response.headers}")
            
            # Tentar analisar a resposta como JSON
            try:
                response_data = response.json()
                debug_print(f"Corpo da resposta: {response_data}")
            except Exception as e:
                debug_print(f"Resposta não é JSON: {response.text}")
            
            # Verificar se o login foi bem-sucedido
            if response.status_code == 200:
                try:
                    # Tentar analisar a resposta como JSON
                    user_data = response.json()
                    debug_print("Login bem-sucedido com resposta JSON!")
                    
                    # Armazenar cookies da sessão e dados do usuário
                    debug_print(f"Cookies da sessão: {self.session.cookies.get_dict()}")
                    debug_print(f"Dados do usuário: {user_data}")
                    
                    # Verificar se o usuário está ativo
                    if user_data.get('isActive') is False:
                        messagebox.showerror('Conta Bloqueada', 'Sua conta foi bloqueada pelo administrador. O aplicativo será encerrado.')
                        self.master.destroy()
                        return
                    
                    # Armazenar dados do usuário para uso posterior
                    self.user_data = user_data
                    
                    # Verificar o arquivo Excel após o login bem-sucedido
                    debug_print("Login bem-sucedido. Verificando arquivo Excel...")
                    excel_file_path = self.check_excel_file()
                    
                    # Fechar a janela de login
                    self.master.destroy()
                    
                    # Iniciar a aplicação principal
                    root = tk.Tk()
                    app = CSVFilterApp(root, self.session, self.user_data, self.credentials, excel_file_path)
                    
                except Exception as e:
                    debug_print(f"Erro ao processar resposta JSON: {str(e)}")
                    messagebox.showerror('Erro', f'Erro ao processar resposta: {str(e)}')
            elif response.status_code == 401:
                # Verificar se a conta está bloqueada
                try:
                    error_data = response.json()
                    error_message = error_data.get('error', '')
                    
                    if 'bloqueada' in error_message.lower():
                        messagebox.showerror('Conta Bloqueada', 'Sua conta foi bloqueada pelo administrador. O aplicativo será encerrado.')
                        self.master.destroy()
                    else:
                        messagebox.showerror('Erro de Login', 'Credenciais inválidas. Por favor, tente novamente.')
                except:
                    messagebox.showerror('Erro de Login', 'Credenciais inválidas. Por favor, tente novamente.')
            else:
                debug_print(f"Erro HTTP: {response.status_code} {response.reason} for url: {response.url}")
                messagebox.showerror('Erro', f'Erro ao conectar: {response.status_code} {response.reason}')
        except requests.exceptions.ConnectionError:
            debug_print("Erro de conexão. Tentando modo offline.")
            messagebox.showwarning('Modo Offline', 'Não foi possível conectar ao servidor. Iniciando em modo offline.')
            
            # Iniciar em modo offline
            self.master.destroy()
            root = tk.Tk()
            app = CSVFilterApp(root, None, {'username': username, 'name': 'Usuário Offline'}, None)
        except Exception as e:
            debug_print(f"Erro inesperado: {str(e)}")
            messagebox.showerror('Erro', f'Ocorreu um erro durante o login: {str(e)}')
            return
            
        # Mesmo se houver erro, definimos self.user_data como um dicionário vazio
        # para evitar erros de NoneType
        if not hasattr(self, 'user_data') or self.user_data is None:
            self.user_data = {"username": username}
            
    def check_excel_file(self):
        """Baixa o arquivo Excel do servidor e o armazena em uma pasta temporária"""
        # Se a verificação no início estiver desativada, apenas retorna o caminho padrão
        if not CHECK_FILE_ON_STARTUP:
            debug_print("Verificação de arquivo no início desativada, usando caminho padrão")
            return XLSX_FILE_PATH
            
        debug_print("Verificando arquivo Excel do servidor...")
        
        # Se estiver configurado para usar arquivo remoto
        if USE_REMOTE_FILE:
            try:
                # Mostrar mensagem de carregamento
                loading_window = tk.Toplevel(self.master)
                loading_window.title("Baixando dados")
                loading_window.geometry("300x100")
                loading_window.transient(self.master)
                loading_window.grab_set()
                
                # Centralizar a janela
                loading_window.update_idletasks()
                width = loading_window.winfo_width()
                height = loading_window.winfo_height()
                x = (loading_window.winfo_screenwidth() // 2) - (width // 2)
                y = (loading_window.winfo_screenheight() // 2) - (height // 2)
                loading_window.geometry('{}x{}+{}+{}'.format(width, height, x, y))
                
                # Adicionar mensagem e barra de progresso
                ttk.Label(loading_window, text="Verificando arquivo de dados do servidor...").pack(pady=10)
                progress = ttk.Progressbar(loading_window, mode='indeterminate')
                progress.pack(fill='x', padx=20)
                progress.start()
                
                # Atualizar a interface
                loading_window.update()
                
                # Tenta baixar o arquivo
                downloaded_file = download_excel_file(use_local_fallback=True)
                
                # Fechar janela de carregamento
                loading_window.destroy()
                
                if downloaded_file and os.path.exists(downloaded_file):
                    debug_print(f"Arquivo obtido com sucesso: {downloaded_file}")
                    return downloaded_file
                else:
                    # Se não conseguiu baixar nem usar fallback, perguntar se deseja continuar sem o arquivo
                    error_msg = "Não foi possível baixar o arquivo do servidor e não há arquivo local disponível.\n\nDeseja tentar novamente?"
                    retry = messagebox.askyesno('Erro ao obter arquivo', error_msg)
                    if retry:
                        # Tentar novamente
                        return self.check_excel_file()
                    else:
                        # Usuário optou por não tentar novamente
                        messagebox.showinfo('Operação cancelada', 'O aplicativo será encerrado.')
                        self.master.destroy()
                        sys.exit(0)
            except Exception as e:
                debug_print(f"Erro ao baixar arquivo: {str(e)}")
                # Verificar se existe um arquivo local para usar como fallback
                base_path = os.path.dirname(os.path.abspath(__file__))
                local_file_path = os.path.join(base_path, 'files', 'dados.xlsx')
                
                if os.path.exists(local_file_path):
                    fallback_msg = f"Erro ao baixar arquivo: {str(e)}\n\nDeseja usar o arquivo local disponível?"
                    use_local = messagebox.askyesno('Erro de conexão', fallback_msg)
                    if use_local:
                        debug_print(f"Usando arquivo local após erro: {local_file_path}")
                        return local_file_path
                
                # Se não há arquivo local ou usuário optou por não usá-lo
                retry_msg = f"Erro ao baixar arquivo: {str(e)}\n\nDeseja tentar novamente?"
                retry = messagebox.askyesno('Erro', retry_msg)
                if retry:
                    return self.check_excel_file()
                else:
                    messagebox.showinfo('Operação cancelada', 'O aplicativo será encerrado.')
                    self.master.destroy()
                    sys.exit(0)
        else:
            # Se não estiver configurado para usar arquivo remoto, usar o caminho padrão
            debug_print("Modo de arquivo remoto desativado. Usando caminho padrão.")
            base_path = os.path.dirname(os.path.abspath(__file__))
            file_path = os.path.join(base_path, 'files', 'dados.xlsx')
            
            if not os.path.exists(file_path):
                error_msg = f"O arquivo de dados não foi encontrado localmente e o modo remoto está desativado.\n\nDeseja ativar o modo remoto e tentar baixar o arquivo?"
                try_remote = messagebox.askyesno('Arquivo não encontrado', error_msg)
                if try_remote:
                    # Criar uma função auxiliar para ativar o modo remoto
                    def activate_remote_mode():
                        global USE_REMOTE_FILE
                        USE_REMOTE_FILE = True
                    
                    # Ativar modo remoto temporariamente
                    activate_remote_mode()
                    return self.check_excel_file()
                else:
                    messagebox.showinfo('Operação cancelada', 'O aplicativo será encerrado.')
                    self.master.destroy()
                    sys.exit(0)
                
            return file_path
    
    def on_closing(self):
        """Método chamado quando o usuário fecha a janela de login"""
        debug_print("Janela de login fechada pelo usuário")
        # Definir session como None para indicar que o login não foi concluído
        self.session = None
        self.user_data = None
        # Destruir a janela
        self.master.destroy()
        # Sair do aplicativo
        import sys
        sys.exit(0)


class CSVFilterApp:
    """Aplicação principal para filtrar e visualizar dados CSV"""
    def __init__(self, root, session=None, user_data=None, credentials=None, excel_file_path=None):
        self.root = root
        self.session = session
        self.user_data = user_data
        self.credentials = credentials
        self.is_closing = False  # Flag para controlar o encerramento da aplicação
        self.status_check_id = None  # ID da verificação de status agendada
        self.excel_file_path = excel_file_path or XLSX_FILE_PATH  # Usar o caminho passado ou o padrão
        self.root.title('Visualizador de Produtos - Sistema de Verificação de Preços')
        self.root.geometry('1000x700')
        
        # Intervalo de verificação do status do usuário (em milissegundos)
        self.check_interval = 30000  # 30 segundos
        
        # Intervalo para verificação de atualizações do arquivo (em milissegundos)
        self.file_check_interval = 300000  # 5 minutos
        self.file_check_id = None  # ID da verificação de atualização do arquivo
        
        # Configurar verificação periódica do status do usuário (apenas no modo online)
        if not OFFLINE_MODE and self.session:
            self.schedule_status_check()
            
        # Configurar verificação periódica de atualizações do arquivo
        self.schedule_file_update_check()
        
        # Tratamento do evento de fechamento da janela
        self.root.protocol("WM_DELETE_WINDOW", self.on_closing)
        
        # Centralizar a janela na tela
        window_width = 1500
        window_height = 700
        screen_width = self.root.winfo_screenwidth()
        screen_height = self.root.winfo_screenheight()
        x_coordinate = int((screen_width/2) - (window_width/2))
        y_coordinate = int((screen_height/2) - (window_height/2))
        self.root.geometry(f"{window_width}x{window_height}+{x_coordinate}+{y_coordinate}")
        
        # Frame principal
        main_frame = ttk.Frame(self.root, padding="10")
        main_frame.pack(fill=tk.BOTH, expand=True)
        
        # Frame superior com informações do usuário e botões
        top_frame = ttk.Frame(main_frame)
        top_frame.pack(fill='x', pady=(0, 10))
        
        # Informações do usuário
        username = self.user_data.get('username', 'Usuário') if self.user_data else 'Usuário'
        user_label = ttk.Label(top_frame, text=f"Usuário: {username}", font=("Arial", 10, "bold"))
        user_label.pack(side='left', padx=10)
        
        # Data e hora atual
        current_time = datetime.now().strftime("%d/%m/%Y %H:%M:%S")
        time_label = ttk.Label(top_frame, text=f"Data: {current_time}")
        time_label.pack(side='left', padx=10)
        
        # Botão para recarregar os dados
        reload_btn = ttk.Button(top_frame, text='Recarregar Dados', command=self.load_data)
        reload_btn.pack(side='right', padx=10)
        
        # Informações do arquivo
        file_frame = ttk.Frame(main_frame)
        file_frame.pack(fill='x', pady=(0, 10))
        
        file_name = os.path.basename(self.excel_file_path)

        
        # Frame para os filtros
        filter_label = ttk.Label(main_frame, text="Filtros:", font=("Arial", 10, "bold"))
        filter_label.pack(anchor='w', padx=10, pady=(0, 5))
        
        self.filter_frame = ttk.Frame(main_frame)
        self.filter_frame.pack(fill='x', padx=10, pady=(0, 10))
        
        # Separador
        separator = ttk.Separator(main_frame, orient='horizontal')
        separator.pack(fill='x', padx=10, pady=5)
        
        # Frame para a tabela
        table_frame = ttk.Frame(main_frame)
        table_frame.pack(fill='both', expand=True, padx=10)
        
        # Treeview com scrollbars
        self.tree = ttk.Treeview(table_frame, show='headings')
        
        # Scrollbars
        vsb = ttk.Scrollbar(table_frame, orient='vertical', command=self.tree.yview)
        hsb = ttk.Scrollbar(table_frame, orient='horizontal', command=self.tree.xview)
        self.tree.configure(yscrollcommand=vsb.set, xscrollcommand=hsb.set)
        
        # Garantir que a barra de rolagem horizontal funcione
        self.tree.configure(xscrollcommand=hsb.set)
        
        # Posicionamento da tabela e scrollbars
        self.tree.grid(row=0, column=0, sticky='nsew')
        vsb.grid(row=0, column=1, sticky='ns')
        hsb.grid(row=1, column=0, sticky='ew')
        
        # Configuração do grid
        table_frame.grid_columnconfigure(0, weight=1)
        table_frame.grid_rowconfigure(0, weight=1)
        
        # Status bar
        self.status_var = tk.StringVar()
        status_bar = ttk.Label(main_frame, textvariable=self.status_var, relief=tk.SUNKEN, anchor='w')
        status_bar.pack(fill='x', padx=10, pady=(5, 0))
        
        self.df = pd.DataFrame()
        self.filter_vars = {}
        
        # Agora carregamos os dados apenas após a inicialização da interface
        self.root.after(100, self.load_data)  # Carrega os dados após 100ms
        
        self.root.mainloop()
    
    def load_data_from_url(self, url):
        """Carrega os dados do Excel diretamente da URL"""
        try:
            self.status_var.set("Carregando dados do servidor...")
            self.root.update_idletasks()
            
            debug_print(f"Tentando carregar Excel diretamente da URL: {url}")
            
            # Tentar carregar o Excel diretamente da URL
            try:
                # Usar um timeout para evitar que a aplicação fique travada
                response = requests.get(url, timeout=30)
                
                if response.status_code == 200:
                    # Verificar se o conteúdo é JSON (indica erro do servidor)
                    if response.text.strip().startswith('{'):
                        debug_print(f"Erro: O servidor retornou JSON em vez de um arquivo Excel: {response.text[:100]}")
                        return None
                    
                    # Carregar o Excel diretamente do conteúdo da resposta
                    import io
                    excel_data = io.BytesIO(response.content)
                    
                    try:
                        # Tentar carregar com openpyxl
                        debug_print("Tentando carregar dados da URL com engine='openpyxl'")
                        df = pd.read_excel(excel_data, engine='openpyxl')
                        debug_print(f"Excel carregado com sucesso da URL. {len(df)} registros encontrados.")
                        return df
                    except Exception as openpyxl_error:
                        debug_print(f"Erro ao carregar com openpyxl da URL: {str(openpyxl_error)}")
                        try:
                            # Resetar o ponteiro do BytesIO
                            excel_data.seek(0)
                            # Tentar com xlrd
                            debug_print("Tentando carregar dados da URL com engine='xlrd'")
                            df = pd.read_excel(excel_data, engine='xlrd')
                            debug_print(f"Excel carregado com sucesso da URL com xlrd. {len(df)} registros encontrados.")
                            return df
                        except Exception as xlrd_error:
                            debug_print(f"Erro ao carregar com xlrd da URL: {str(xlrd_error)}")
                            return None
                else:
                    debug_print(f"Erro ao acessar URL. Status code: {response.status_code}")
                    return None
            except requests.exceptions.RequestException as e:
                debug_print(f"Erro de conexão ao acessar URL: {str(e)}")
                return None
        except Exception as e:
            debug_print(f"Erro inesperado ao carregar dados da URL: {str(e)}")
            return None
    
    def load_data(self):
        """Carrega os dados do arquivo Excel"""
        try:
            self.status_var.set("Carregando dados...")
            self.root.update_idletasks()
            
            # Tentar carregar diretamente da URL primeiro se estiver no modo remoto
            if USE_REMOTE_FILE:
                debug_print("Tentando carregar dados diretamente da URL...")
                df = self.load_data_from_url(EXCEL_URL)
                
                if df is not None:
                    # Se conseguiu carregar da URL, usar esses dados
                    self.df = df
                    self.status_var.set(f"Dados carregados com sucesso do servidor. {len(self.df)} registros encontrados.")
                    debug_print(f"Dados carregados com sucesso diretamente da URL. {len(self.df)} registros encontrados.")
                    
                    # Construir filtros e atualizar tabela
                    self.build_filters()
                    self.update_table()
                    return
                else:
                    debug_print("Não foi possível carregar dados da URL. Tentando arquivo local...")
            
            # Se não conseguiu carregar da URL ou não está no modo remoto, tentar arquivo local
            # Verificar se o arquivo existe, se não existir, tentar baixar
            if not os.path.exists(self.excel_file_path):
                debug_print(f"Arquivo não encontrado: {self.excel_file_path}")
                # Tentar baixar o arquivo
                if USE_REMOTE_FILE:
                    debug_print("Tentando baixar o arquivo do servidor...")
                    self.status_var.set("Baixando arquivo do servidor...")
                    self.root.update_idletasks()
                    
                    downloaded_file = download_excel_file(use_local_fallback=True)
                    
                    if downloaded_file and os.path.exists(downloaded_file):
                        debug_print(f"Arquivo baixado com sucesso: {downloaded_file}")
                        self.excel_file_path = downloaded_file
                    else:
                        messagebox.showerror('Arquivo não encontrado', 
                                           'O arquivo de dados não foi encontrado.\n\nVerifique se o arquivo existe ou tente fazer login novamente.')
                        self.status_var.set("Erro: Arquivo não encontrado.")
                        return
                else:
                    messagebox.showerror('Arquivo não encontrado', 
                                       'O arquivo de dados não foi encontrado e o modo remoto está desativado.')
                    self.status_var.set("Erro: Arquivo não encontrado.")
                    return
            
            debug_print(f"Usando arquivo Excel: {self.excel_file_path}")
            debug_print(f"Tentando carregar o arquivo Excel: {self.excel_file_path}")
            
            # Verificar se o arquivo está corrompido ou não é um arquivo Excel válido
            try:
                # Primeiro tenta com engine='openpyxl'
                debug_print("Tentando carregar com engine='openpyxl'")
                self.df = pd.read_excel(self.excel_file_path, engine='openpyxl')
            except Exception as openpyxl_error:
                debug_print(f"Erro ao carregar com openpyxl: {str(openpyxl_error)}")
                try:
                    # Se falhar, tenta com engine='xlrd'
                    debug_print("Tentando carregar com engine='xlrd'")
                    self.df = pd.read_excel(self.excel_file_path, engine='xlrd')
                except Exception as xlrd_error:
                    debug_print(f"Erro ao carregar com xlrd: {str(xlrd_error)}")
                    
                    # Verificar se o arquivo está corrompido
                    if "not a zip file" in str(openpyxl_error) or "corrupt file" in str(xlrd_error):
                        # Arquivo provavelmente está corrompido, perguntar se deseja baixar novamente
                        redownload = messagebox.askyesno(
                            'Arquivo corrompido', 
                            f"O arquivo Excel parece estar corrompido ou não é um arquivo Excel válido.\n\n" +
                            f"Erro: {str(openpyxl_error)}\n\n" +
                            f"Deseja tentar baixar o arquivo novamente do servidor?"
                        )
                        
                        if redownload:
                            # Remover o arquivo corrompido
                            try:
                                os.remove(self.excel_file_path)
                                debug_print(f"Arquivo corrompido removido: {self.excel_file_path}")
                            except Exception as e:
                                debug_print(f"Erro ao remover arquivo corrompido: {str(e)}")
                            
                            # Baixar novamente
                            self.status_var.set("Baixando arquivo do servidor...")
                            self.root.update_idletasks()
                            
                            downloaded_file = download_excel_file()
                            
                            if downloaded_file and os.path.exists(downloaded_file):
                                # Tentar carregar novamente
                                try:
                                    self.df = pd.read_excel(downloaded_file, engine='openpyxl')
                                    debug_print(f"Arquivo baixado e carregado com sucesso!")
                                except Exception as e:
                                    error_msg = f"O arquivo foi baixado, mas ainda não foi possível carregá-lo.\n\nErro: {str(e)}"
                                    messagebox.showerror('Erro ao carregar arquivo', error_msg)
                                    self.status_var.set("Erro ao carregar arquivo.")
                                    return
                            else:
                                error_msg = "Não foi possível baixar o arquivo do servidor. Verifique sua conexão."
                                messagebox.showerror('Erro ao baixar arquivo', error_msg)
                                self.status_var.set("Erro: Não foi possível baixar o arquivo.")
                                return
                        else:
                            self.status_var.set("Operação cancelada pelo usuário.")
                            return
                    else:
                        # Se não for problema de arquivo corrompido, exibe mensagem de erro detalhada
                        error_msg = f"Não foi possível determinar o formato do arquivo Excel.\n\nErro openpyxl: {str(openpyxl_error)}\n\nErro xlrd: {str(xlrd_error)}\n\nVerifique se as bibliotecas 'openpyxl' e 'xlrd' estão instaladas:\npip install openpyxl xlrd"
                        messagebox.showerror('Erro ao carregar arquivo Excel', error_msg)
                        self.status_var.set("Erro ao carregar arquivo Excel. Verifique as dependências.")
                        return
            
            # Se chegou aqui, o arquivo foi carregado com sucesso
            debug_print(f"Arquivo carregado com sucesso. {len(self.df)} registros encontrados.")
            self.status_var.set(f"Dados carregados com sucesso. {len(self.df)} registros encontrados.")
            
            # Construir filtros e atualizar tabela
            self.build_filters()
            self.update_table()
            
        except FileNotFoundError as e:
            debug_print(f"Erro de arquivo não encontrado: {str(e)}")
            messagebox.showerror('Arquivo não encontrado', str(e))
            self.status_var.set("Erro: Arquivo não encontrado.")
        except Exception as e:
            debug_print(f"Erro inesperado ao carregar dados: {str(e)}")
            messagebox.showerror('Erro ao carregar dados', str(e))
            self.status_var.set(f"Erro ao carregar dados: {str(e)}")
            return

    def build_filters(self):
        # Limpa filtros antigos
        for w in self.filter_frame.winfo_children():
            w.destroy()
        self.filter_vars.clear()
        
        # Imprimir os nomes das colunas para debug
        debug_print(f"Colunas no DataFrame: {list(self.df.columns)}")
        
        # Verificar se as colunas PRODUTO e PLATAFORMA existem
        has_produto = 'PRODUTO' in self.df.columns
        has_plataforma = 'PLATAFORMA' in self.df.columns
        debug_print(f"Coluna PRODUTO existe: {has_produto}")
        debug_print(f"Coluna PLATAFORMA existe: {has_plataforma}")
        
        # Verificar se há alguma coluna similar a PLATAFORMA (com espaço no final ou diferença de maiúsculas/minúsculas)
        plataforma_similar = [col for col in self.df.columns if col.upper().strip() == 'PLATAFORMA']
        debug_print(f"Colunas similares a PLATAFORMA: {plataforma_similar}")
        
        # Encontrar a coluna PLATAFORMA (mesmo com espaço no final)
        self.plataforma_col = next((col for col in self.df.columns if col.upper().strip() == 'PLATAFORMA'), None)
        debug_print(f"Coluna PLATAFORMA encontrada: {self.plataforma_col}")
        
        # Encontrar a coluna PRODUTO
        self.produto_col = next((col for col in self.df.columns if col.upper().strip() == 'PRODUTO'), None)
        debug_print(f"Coluna PRODUTO encontrada: {self.produto_col}")
        
        # Encontrar a coluna PREÇO
        self.preco_col = next((col for col in self.df.columns if col.upper().strip() == 'PREÇO'), None)
        debug_print(f"Coluna PREÇO encontrada: {self.preco_col}")

        # Cria widgets de filtro para cada coluna
        for col in self.df.columns:
            ttk.Label(self.filter_frame, text=col).pack(side='left', padx=5)
            var = tk.StringVar()
            
            # Usar Combobox com pesquisa para PRODUTO e PLATAFORMA (ou variações)
            if (self.produto_col and col == self.produto_col) or (self.plataforma_col and col == self.plataforma_col):
                debug_print(f"Criando combobox para coluna: {col}")
                # Obter valores únicos para o dropdown
                unique_values = sorted(self.df[col].dropna().unique().tolist())
                debug_print(f"Valores únicos para {col}: {unique_values[:10]}" + (
                    "... e mais" if len(unique_values) > 10 else ""))
                
                # Criar o combobox
                combo = ttk.Combobox(self.filter_frame, textvariable=var, values=unique_values)
                combo.pack(side='left', padx=5)
                
                # Configurar para permitir pesquisa (padrão do Combobox)
                # Atualizar a tabela quando o valor mudar
                var.trace_add('write', lambda *args, c=col: self.update_table())
                
                # Também atualizar quando o usuário selecionar um item da lista
                combo.bind('<<ComboboxSelected>>', lambda event, c=col: self.update_table())
            else:
                # Para outras colunas, usar Entry normal
                ent = ttk.Entry(self.filter_frame, textvariable=var)
                ent.pack(side='left', padx=5)
                # Atualiza tabela sempre que variável muda
                var.trace_add('write', lambda *args, c=col: self.update_table())
            
            self.filter_vars[col] = var

        # Configura colunas da Treeview
        self.tree['columns'] = list(self.df.columns)
        
        # Primeiro, configurar todas as colunas para não esticar (stretch=False)
        for col in self.df.columns:
            self.tree.column(col, stretch=False)
        
        # Configurar cada coluna individualmente com larguras fixas
        for i, col in enumerate(self.df.columns):
            col_key = col.strip()
            
            # Configurar cabeçalho
            self.tree.heading(col, text=col)
            
            # Configurar larguras específicas para cada coluna, permitindo redimensionamento manual
            if col_key == 'PRODUTO':
                self.tree.column(col, width=80, minwidth=50, stretch=False, anchor='w')
            elif col_key == 'DESCRIÇÃO DO SITE':
                self.tree.column(col, width=350, minwidth=100, stretch=True, anchor='w')  # Esta coluna pode esticar
            elif col_key == 'PREÇO':
                self.tree.column(col, width=80, minwidth=50, stretch=True, anchor='center')  # Alinhado ao centro
            elif col_key == 'PLATAFORMA':
                self.tree.column(col, width=100, minwidth=50, stretch=False, anchor='w')
            else:
                self.tree.column(col, width=100, minwidth=50, stretch=False, anchor='w')
                
        # Adicionar evento para salvar as larguras das colunas quando o usuário redimensioná-las
        self.tree.bind('<ButtonRelease-1>', self.save_column_widths)

    def save_column_widths(self, event=None):
        """Salva as larguras das colunas quando o usuário as redimensiona"""
        # Esta função é chamada quando o usuário solta o botão do mouse após redimensionar uma coluna
        # Não precisamos fazer nada especial aqui, pois o tkinter já atualiza as larguras automaticamente
        # Mas podemos usar esta função para salvar as preferências do usuário em um arquivo de configuração se desejarmos
        pass
        
    def calculate_column_widths(self):
        """Calcula a largura ideal para cada coluna com base no conteúdo"""
        column_widths = {}
        font = tkfont.Font(family="TkDefaultFont", size=10)  # Fonte padrão do tkinter
        
        # Definir larguras máximas personalizadas para cada tipo de coluna
        max_widths = {
            'PRODUTO': 120,      # Coluna PRODUTO mais estreita
            'DESCRIÇÃO DO SITE': 300,  # Descrição pode ser mais larga
            'PREÇO': 100,        # Preço não precisa ser muito largo
            'PLATAFORMA': 120     # Plataforma também pode ser mais estreita
        }
        
        # Adicionar largura para os cabeçalhos das colunas
        for col in self.df.columns:
            header_width = font.measure(col) + 20  # Adicionar margem
            column_widths[col] = header_width
        
        # Amostragem de dados para não processar todas as linhas (melhora performance)
        # Usar no máximo 100 linhas para calcular larguras
        sample_size = min(100, len(self.df))
        sample_df = self.df.sample(n=sample_size) if len(self.df) > sample_size else self.df
        
        # Calcular a largura máxima para cada coluna com base nos dados da amostra
        for _, row in sample_df.iterrows():
            for col in self.df.columns:
                value = row[col]
                
                # Formatar preços para cálculo correto da largura
                if self.preco_col and col == self.preco_col:
                    try:
                        if isinstance(value, str):
                            price_str = ''.join(char for char in value if char.isdigit() or char == '.')
                            price_value = float(price_str)
                        else:
                            price_value = float(value)
                        value = f"R$ {price_value:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.')
                    except (ValueError, TypeError):
                        value = str(value)
                else:
                    value = str(value)
                
                # Medir a largura do texto e atualizar se for maior que a atual
                text_width = font.measure(value) + 20  # Adicionar margem
                if text_width > column_widths.get(col, 0):
                    column_widths[col] = text_width
        
        # Aplicar limites personalizados para cada coluna
        for col in column_widths:
            # Obter o nome da coluna sem espaços no final para comparação
            col_key = col.strip()
            
            # Encontrar a largura máxima para esta coluna
            # Verificar se a coluna tem uma largura máxima personalizada
            max_width = max_widths.get(col_key, 200)  # Padrão de 200 pixels se não especificado
            
            # Aplicar o limite máximo personalizado
            column_widths[col] = min(column_widths[col], max_width)
            
            # Garantir uma largura mínima de 50 pixels
            column_widths[col] = max(column_widths[col], 50)
        
        # Ajuste especial para a coluna PRODUTO (se existir)
        if self.produto_col and self.produto_col in column_widths:
            column_widths[self.produto_col] = min(column_widths[self.produto_col], 120)
        
        return column_widths
        
    def update_table(self):
        df = self.df.copy()
        # Aplica filtros
        for col, var in self.filter_vars.items():
            val = var.get().strip()
            if val:
                df = df[df[col].astype(str).str.contains(val, case=False, na=False)]

        # Configurar as tags para as cores alternadas (se ainda não estiverem configuradas)
        if not hasattr(self, 'tags_configured'):
            # Configurar as cores para as linhas alternadas
            self.tree.tag_configure('odd', background='#f0f0f0')  # Cinza claro para linhas ímpares
            self.tree.tag_configure('even', background='white')   # Branco para linhas pares
            self.tags_configured = True

        # Atualiza Treeview
        self.tree.delete(*self.tree.get_children())
        
        # Contador para alternar as cores das linhas
        row_count = 0
        
        for _, row in df.iterrows():
            vals = []
            for c in self.df.columns:
                # Formatar a coluna PREÇO no padrão brasileiro (R$ com pontos e vírgulas)
                if self.preco_col and c == self.preco_col:
                    try:
                        # Converter para float caso seja string
                        if isinstance(row[c], str):
                            # Remover caracteres não numéricos exceto ponto decimal
                            price_str = ''.join(char for char in row[c] if char.isdigit() or char == '.')
                            price_value = float(price_str)
                        else:
                            price_value = float(row[c])
                            
                        # Formatar no padrão brasileiro
                        formatted_price = f"R$ {price_value:,.2f}".replace(',', 'X').replace('.', ',').replace('X', '.')
                        vals.append(formatted_price)
                    except (ValueError, TypeError):
                        # Se não conseguir converter, manter o valor original
                        vals.append(str(row[c]))
                else:
                    vals.append(row[c])
            
            # Determinar a tag com base no número da linha (par ou ímpar)
            tag = 'odd' if row_count % 2 == 1 else 'even'
            
            # Inserir a linha com a tag apropriada
            self.tree.insert('', 'end', values=vals, tags=(tag,))
            
            # Incrementar o contador de linhas
            row_count += 1
            
    def schedule_status_check(self):
        """Agenda a próxima verificação de status do usuário"""
        # Não agendar nova verificação se a aplicação estiver sendo encerrada
        if self.is_closing:
            debug_print("Aplicação está sendo encerrada, não agendando nova verificação")
            return
            
        # Cancelar qualquer verificação anterior que possa estar pendente
        if self.status_check_id is not None:
            try:
                self.root.after_cancel(self.status_check_id)
            except Exception as e:
                debug_print(f"Erro ao cancelar verificação anterior: {str(e)}")
            
        debug_print(f"Agendando próxima verificação de status em {self.check_interval/1000} segundos")
        self.status_check_id = self.root.after(self.check_interval, self.check_user_status)
    
    def schedule_file_update_check(self):
        """Agenda a próxima verificação de atualizações do arquivo no servidor"""
        # Não agendar nova verificação se a aplicação estiver sendo encerrada
        if self.is_closing:
            debug_print("Aplicação está sendo encerrada, não agendando nova verificação de arquivo")
            return
            
        # Cancelar qualquer verificação anterior que possa estar pendente
        if self.file_check_id is not None:
            try:
                self.root.after_cancel(self.file_check_id)
            except Exception as e:
                debug_print(f"Erro ao cancelar verificação anterior de arquivo: {str(e)}")
        
        # Se não estiver configurado para usar arquivo remoto, usar intervalo maior
        if not USE_REMOTE_FILE:
            # Verificar a cada 30 minutos mesmo quando não está usando arquivo remoto
            # (caso a configuração mude durante a execução)
            check_interval = 1800000  # 30 minutos
            debug_print(f"Modo remoto desativado. Agendando verificação de atualização em 30 minutos")
        else:
            # Usar o intervalo normal quando estiver usando arquivo remoto
            check_interval = self.file_check_interval
            debug_print(f"Agendando próxima verificação de atualização do arquivo em {check_interval/60000} minutos")
            
        self.file_check_id = self.root.after(check_interval, self.check_file_updates)
    
    def check_file_updates(self):
        """Verifica se há atualizações no arquivo Excel do servidor e carrega diretamente da URL"""
        # Não executar a verificação se a aplicação estiver sendo encerrada
        if self.is_closing:
            debug_print("Aplicação está sendo encerrada, pulando verificação de atualização do arquivo")
            return
            
        # Não executar a verificação se não estiver configurado para usar arquivo remoto
        if not USE_REMOTE_FILE:
            debug_print("Modo de arquivo remoto desativado, pulando verificação de atualizações")
            # Agendar próxima verificação mesmo assim (caso o modo seja ativado depois)
            self.schedule_file_update_check()
            return
            
        debug_print("Verificando arquivo atualizado do servidor...")
        
        try:
            # Atualizar a barra de status
            self.status_var.set("Verificando atualizações do servidor...")
            self.root.update_idletasks()
            
            # Tentar carregar diretamente da URL
            df = self.load_data_from_url(EXCEL_URL)
            
            if df is not None:
                debug_print("Dados atualizados carregados com sucesso da URL")
                
                # Atualizar o DataFrame com os novos dados
                self.df = df
                
                # Atualizar a interface
                self.build_filters()
                self.update_table()
                
                self.status_var.set(f"Dados atualizados com sucesso. {len(self.df)} registros encontrados.")
            else:
                debug_print("Não foi possível carregar atualizações da URL")
                self.status_var.set("Não foi possível verificar atualizações do servidor")
        except Exception as e:
            debug_print(f"Erro ao verificar atualizações: {str(e)}")
            self.status_var.set(f"Erro ao verificar atualizações: {str(e)}")
            
        # Agendar próxima verificação
        self.schedule_file_update_check()

    def on_closing(self):
        """Método chamado quando o usuário fecha a janela principal"""
        debug_print("Janela principal fechada pelo usuário. Encerrando aplicativo...")
        
        # Definir a flag para indicar que a aplicação está sendo encerrada
        self.is_closing = True
        
        # Cancelar a verificação de status agendada
        if self.status_check_id is not None:
            try:
                self.root.after_cancel(self.status_check_id)
                debug_print(f"Verificação de status cancelada: {self.status_check_id}")
                self.status_check_id = None
            except Exception as e:
                debug_print(f"Erro ao cancelar verificação de status: {str(e)}")
                
        # Cancelar a verificação de atualização de arquivo agendada
        if self.file_check_id is not None:
            try:
                self.root.after_cancel(self.file_check_id)
                debug_print(f"Verificação de atualização de arquivo cancelada: {self.file_check_id}")
                self.file_check_id = None
            except Exception as e:
                debug_print(f"Erro ao cancelar verificação de atualização de arquivo: {str(e)}")
        
        # Limpar arquivos temporários
        self.cleanup_temp_files()
        
        # Destruir a janela
        self.root.destroy()
        
        # Encerrar a aplicação completamente
        import sys
        sys.exit(0)
        
    def cleanup_temp_files(self):
        """Limpa os arquivos temporários criados pelo aplicativo"""
        try:
            # Verificar se o arquivo está em uma pasta temporária
            import tempfile
            temp_dir = tempfile.gettempdir()
            temp_app_dir = os.path.join(temp_dir, 'meuagendamentopro')
            
            if os.path.exists(temp_app_dir):
                debug_print(f"Limpando arquivos temporários em: {temp_app_dir}")
                
                # Remover todos os arquivos na pasta temporária
                for filename in os.listdir(temp_app_dir):
                    file_path = os.path.join(temp_app_dir, filename)
                    try:
                        if os.path.isfile(file_path):
                            os.remove(file_path)
                            debug_print(f"Arquivo temporário removido: {file_path}")
                    except Exception as e:
                        debug_print(f"Erro ao remover arquivo temporário {file_path}: {str(e)}")
                
                # Tentar remover a pasta
                try:
                    os.rmdir(temp_app_dir)
                    debug_print(f"Pasta temporária removida: {temp_app_dir}")
                except Exception as e:
                    debug_print(f"Erro ao remover pasta temporária: {str(e)}")
        except Exception as e:
            debug_print(f"Erro durante limpeza de arquivos temporários: {str(e)}")
    
    def check_user_status(self):
        """Verifica se o usuário ainda está ativo no sistema"""
        # Não executar a verificação se a aplicação estiver sendo encerrada
        if self.is_closing:
            debug_print("Aplicação está sendo encerrada, pulando verificação de status")
            return
            
        debug_print("Verificando status do usuário...")
        
        try:
            # Verificar se temos as credenciais e dados do usuário
            if not self.credentials or not self.user_data:
                debug_print("Credenciais ou dados do usuário não disponíveis, pulando verificação")
                self.schedule_status_check()
                return
            
            username = self.user_data.get('username')
            if not username:
                debug_print("Nome de usuário não disponível, pulando verificação")
                self.schedule_status_check()
                return
            
            # Verificar se o usuário ainda está ativo tentando fazer login com as credenciais reais
            debug_print(f"Verificando status do usuário {username} usando as credenciais reais")
            
            # Criar uma nova sessão para o teste de login
            test_session = requests.Session()
            
            headers = {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
            
            # Usar as credenciais reais para verificar o status
            try:
                # Usar as credenciais armazenadas durante o login inicial
                login_data = {
                    'username': self.credentials['username'],
                    'password': self.credentials['password']
                }
                
                debug_print(f"Verificando status com login real para: {username}")
                login_resp = test_session.post(AUTH_URL, json=login_data, headers=headers)
                
                debug_print(f"Status da resposta: {login_resp.status_code}")
                
                # Se o login falhar com 401, verificar a mensagem de erro
                if login_resp.status_code == 401:
                    try:
                        error_data = login_resp.json()
                        error_message = error_data.get('error', 'Credenciais inválidas')
                        debug_print(f"Mensagem de erro: {error_message}")
                        
                        # Verificar se a mensagem de erro indica que o usuário foi bloqueado
                        if 'bloqueada' in error_message.lower():
                            debug_print(f"Usuário bloqueado! Mensagem: {error_message}")
                            messagebox.showerror(
                                'Conta Bloqueada', 
                                'Sua conta foi bloqueada pelo administrador. O aplicativo será encerrado.'
                            )
                            self.root.destroy()
                            import sys
                            sys.exit(1)
                            return
                        else:
                            # Se a mensagem de erro não indicar que a conta está bloqueada,
                            # mas ainda assim falhou com as credenciais corretas, algo está errado
                            debug_print("Erro de login com credenciais corretas - possível alteração de senha")
                    except Exception as json_err:
                        debug_print(f"Erro ao analisar resposta JSON de erro: {str(json_err)}")
                elif login_resp.status_code == 200:
                    # Se o login for bem-sucedido, verificar se o usuário está ativo nos dados retornados
                    try:
                        user_data = login_resp.json()
                        if user_data.get('isActive') is False:
                            debug_print("Usuário bloqueado segundo dados do login!")
                            messagebox.showerror(
                                'Conta Bloqueada', 
                                'Sua conta foi bloqueada pelo administrador. O aplicativo será encerrado.'
                            )
                            self.root.destroy()
                            import sys
                            sys.exit(1)
                            return
                        else:
                            debug_print("Login bem-sucedido, usuário ainda está ativo")
                            # Atualizar os dados do usuário com os mais recentes
                            self.user_data = user_data
                    except Exception as json_err:
                        debug_print(f"Erro ao analisar resposta JSON de login: {str(json_err)}")
            except Exception as req_err:
                debug_print(f"Erro ao verificar status via login: {str(req_err)}")
            
            # Se chegamos até aqui, assumimos que o usuário ainda está ativo
            debug_print("Nenhum bloqueio detectado, assumindo que o usuário ainda está ativo")
            
            # Agendar próxima verificação
            self.schedule_status_check()
                
        except requests.exceptions.ConnectionError as conn_err:
            debug_print(f"Erro de conexão ao verificar status: {str(conn_err)}")
            # Continuar agendando verificações mesmo com erro
            self.schedule_status_check()
        except Exception as e:
            debug_print(f"Erro ao verificar status do usuário: {str(e)}")
            # Continuar agendando verificações mesmo com erro
            self.schedule_status_check()


if __name__ == '__main__':
    # Verificar se o arquivo XLSX existe antes de iniciar apenas se CHECK_FILE_ON_STARTUP estiver ativado
    if CHECK_FILE_ON_STARTUP and not os.path.exists(XLSX_FILE_PATH):
        messagebox.showerror('Erro', f'Arquivo não encontrado: {os.path.basename(XLSX_FILE_PATH)}\n\nO arquivo deve estar na pasta "files".')
        import sys
        sys.exit(1)
    
    # Se estiver no modo offline, pular a tela de login
    if OFFLINE_MODE:
        debug_print("Iniciando em modo offline (sem autenticação)")
        # Criar uma sessão vazia e dados de usuário padrão
        session = requests.Session()
        user_data = {"username": "Usuário Local"}
        root = tk.Tk()
        CSVFilterApp(root, session, user_data, None)
    else:
        # Abre janela de login
        root_login = tk.Tk()
        login = LoginWindow(root_login)
        root_login.mainloop()

        # Se obteve sessão, abre a aplicação principal
        if login.session:
            root = tk.Tk()
            app = CSVFilterApp(root, login.session, login.user_data, login.credentials)
        else:
            # Caso contrário, exibe uma mensagem e encerra
            messagebox.showinfo('Sessão', 'Login não realizado. Encerrando.')
            import sys
            sys.exit(0)
