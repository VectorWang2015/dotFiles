"               ,---,                                                                              
"            ,`--.' |                                                 ____                         
"            |   :  : .--.--.                          ,---,        ,'  , `.,-.----.     ,----..   
"       ,---.|   |  '/  /    '.                ,---.,`--.' |     ,-+-,.' _ |\    /  \   /   /   \  
"      /__./|'   :  |  :  /`. /               /__./||   :  :  ,-+-. ;   , ||;   :    \ |   :     : 
" ,---.;  ; |;   |.';  |  |--`           ,---.;  ; |:   |  ' ,--.'|'   |  ;||   | .\ : .   |  ;. / 
"/___/ \  | |'---'  |  :  ;_            /___/ \  | ||   :  ||   |  ,', |  ':.   : |: | .   ; /--`  
"\   ;  \ ' |        \  \    `.         \   ;  \ ' |'   '  ;|   | /  | |  |||   |  \ : ;   | ;     
" \   \  \: |         `----.   \         \   \  \: ||   |  |'   | :  | :  |,|   : .  / |   : |     
"  ;   \  ' .         __ \  \  |          ;   \  ' .'   :  ;;   . |  ; |--' ;   | |  \ .   | '___  
"   \   \   '        /  /`--'  /           \   \   '|   |  '|   : |  | ,    |   | ;\  \'   ; : .'| 
"    \   `  ;       '--'.     /             \   `  ;'   :  ||   : '  |/     :   ' | \.''   | '/  : 
"     :   \ |         `--'---'               :   \ |;   |.' ;   | |`-'      :   : :-'  |   :    /  
"      '---"                                  '---" '---'   |   ;/          |   |.'     \   \ .'   
"                                                           '---'           `---'        `---`     


let mapleader = " "
" Vim with all enhancements
" source $VIMRUNTIME/vimrc_example.vim

set nocompatible
filetype on
filetype indent on
filetype plugin on
filetype plugin indent on
set encoding=UTF-8
let &t_ut=''


"set tab stop
set tabstop=2
set shiftwidth=2
set softtabstop=2
set list
"show spaces in behind sentence
set listchars=tab:▸\ ,trail:▫
set scrolloff=5
set tw=0
set indentexpr=
set backspace=indent,eol,start
set foldmethod=indent
set foldlevel=99

set laststatus=2
set autochdir
"cursor save after closing file
au BufReadPost * if line("'\"") > 1 && line("'\"") <= line("$") | exe "normal! g'\"" | endif


let &t_SI = "\<Esc>]50;CursorShape=1\x7"
let &t_SR = "\<Esc>]50;CursorShape=2\x7"
let &t_EI = "\<Esc>]50;CursorShape=0\x7"

"no window toolbar
set go=
"set font
set guifont=JetBrains_Mono_Regular:h14
"hide mouse when press keyboard
set mousehide

set cursorline
set wrap
set showcmd
set wildmenu
"hl search
set hlsearch
exec "nohl"
set incsearch
set ignorecase
set smartcase
"default windows size
"set lines=150 columns=100
"colo bluegreen

"line num
set nu

""signal match
"inoremap ( ()<Esc>i
"inoremap [ []<Esc>i
""inoremap < <><Esc>i
"inoremap { {}<Esc>i
"inoremap ' ''<Esc>i
"inoremap " ""<Esc>i

noremap - Nzz
noremap = nzz
noremap <LEADER><CR> :nohl<CR>

"split settings
map sh :set nosplitright<CR>:vsplit<CR>
map sl :set splitright<CR>:vsplit<CR>
map sj :set splitbelow<CR>:split<CR>
map sk :set nosplitbelow<CR>:split<CR>
map sv <C-w>t<C-w>H
map sn <C-w>t<C-w>K
map <LEADER>h <C-w>h
map <LEADER>j <C-w>j
map <LEADER>k <C-W>k
map <LEADER>l <C-w>l
map <up> :resize +5<CR>
map <down> :resize -5<CR>
map <right> :vertical resize +5<CR>
map <left> :vertical resize -5<CR>
"map <LEADER>tm :TableModeToggle<CR>

"tabe settings
map tn :tabe<CR>
map th :tabp<CR>
map tl :tabn<CR>

"spell check
map <LEADER>sc :set spell!<CR>
"jump to next '<++>' and edit it
map <LEADER><LEADER> <Esc>/<++><CR>:nohlsearch<CR>c4l
"edit vimrc
map <LEADER>vr <Esc>:e $VIM/_vimrc<CR>


"plugin here
call plug#begin('$HOME/.vim/plugged')

Plug 'vim-airline/vim-airline'
Plug 'connorholyday/vim-snazzy'

" File navigation
Plug 'preservim/nerdtree', { 'on': 'NERDTreeToggle' }
Plug 'Xuyuanp/nerdtree-git-plugin'
Plug 'tiagofumo/vim-nerdtree-syntax-highlight'
Plug 'ryanoasis/vim-devicons'

" Taglist
Plug 'preservim/tagbar', { 'on': 'TagbarOpenAutoClose' }

" Error checking
Plug 'w0rp/ale'

" Smart surround
Plug 'tpope/vim-surround'

" Markdown
Plug 'iamcco/markdown-preview.nvim', { 'do': { -> mkdp#util#install() }, 'for': ['markdown', 'vim-plug']}
Plug 'dhruvasagar/vim-table-mode'

"Auto Complete
Plug 'prabirshrestha/vim-lsp'
Plug 'mattn/vim-lsp-settings'
Plug 'prabirshrestha/asyncomplete.vim'
Plug 'prabirshrestha/asyncomplete-lsp.vim'


""" Undo Tree
""Plug 'mbbill/undotree/'
""
" Other visual enhancement
Plug 'nathanaelkane/vim-indent-guides'
Plug 'itchyny/vim-cursorword'
""
""" Git
""Plug 'rhysd/conflict-marker.vim'
""Plug 'tpope/vim-fugitive'
""Plug 'mhinz/vim-signify'
""Plug 'gisphm/vim-gitignore', { 'for': ['gitignore', 'vim-plug'] }
""
""" HTML, CSS, JavaScript, PHP, JSON, etc.
""Plug 'elzr/vim-json'
""Plug 'hail2u/vim-css3-syntax'
""Plug 'spf13/PIV', { 'for' :['php', 'vim-plug'] }
""Plug 'gko/vim-coloresque', { 'for': ['vim-plug', 'php', 'html', 'javascript', 'css', 'less'] }
""Plug 'pangloss/vim-javascript', { 'for' :['javascript', 'vim-plug'] }
""Plug 'mattn/emmet-vim'
""
""" Python
""Plug 'vim-scripts/indentpython.vim'
""
""Plug 'vimwiki/vimwiki'
""
""" Bookmarks
""Plug 'kshenoy/vim-signature'
""
""" Other useful utilities
""Plug 'terryma/vim-multiple-cursors'
""Plug 'junegunn/goyo.vim' " distraction free writing mode
""Plug 'godlygeek/tabular' " type ;Tabularize /= to align the =
""Plug 'gcmt/wildfire.vim' " in Visual mode, type i' to select all text in '', or type i) i] i} ip
""Plug 'scrooloose/nerdcommenter' " in <space>cc to comment a line
""
""" Dependencies
""Plug 'MarcWeber/vim-addon-mw-utils'
""Plug 'kana/vim-textobj-user'
""Plug 'fadein/vim-FIGlet'

call plug#end()

autocmd SourcePost * colorscheme snazzy
autocmd SourcePost * let g:SnazzyTransparent = 1

" ===
" === Nerd tree settings
" ===
map <C-n> :NERDTreeToggle<CR>
let NERDTreeMapOpenInTab = "o"


" ===
" === Nerd tree git settings
" ===
let g:NERDTreeIndicatorMapCustom = {
    \ "Modified"  : "✹",
    \ "Staged"    : "✚",
    \ "Untracked" : "✭",
    \ "Renamed"   : "➜",
    \ "Unmerged"  : "═",
    \ "Deleted"   : "✖",
    \ "Dirty"     : "✗",
    \ "Clean"     : "✔︎",
    \ "Unknown"   : "?"
    \ }


" ===
" === Tagbar settings
" ===
map <C-m> :TagbarOpenAutoClose<CR>


" ===
" === ale
" ===
"keep the sign gutter open
let g:ale_sign_column_always = 1
let g:ale_sign_error = '>>'
let g:ale_sign_warning = '--'
" show errors or warnings in my statusline
let g:airline#extensions#ale#enabled = 1

let b:ale_linters = ['pylint']
let b:ale_fixers = ['autopep8', 'yapf']


" ===
" === Markdown
" ===
" set to 1, preview server available to others in your network
" by default, the server listens on localhost (127.0.0.1)
" default: 0
let g:mkdp_open_to_the_world = 1
" use custom IP to open preview page
" useful when you work in remote vim and preview on local browser
" more detail see: https://github.com/iamcco/markdown-preview.nvim/pull/9
" default empty
let g:mkdp_open_ip = ''
let g:mkdp_echo_preview_url = 1
" a custom vim function name to open preview page
" this function will receive url as param
" default is empty
let g:mkdp_browserfunc = ''
" use a custom markdown style must be absolute path
" like '/Users/username/markdown.css' or expand('~/markdown.css')
let g:mkdp_markdown_css = 'C:\Users\VectorWang\.vim\CSS\github.css'
" use a custom highlight style must absolute path
" like '/Users/username/highlight.css' or expand('~/highlight.css')
let g:mkdp_highlight_css = ''
" use a custom port to start server or random for empty
let g:mkdp_port = '2333'


" ===
" === TableMode
" ===
" table mode start with |
function! s:isAtStartOfLine(mapping)
  let text_before_cursor = getline('.')[0 : col('.')-1]
  let mapping_pattern = '\V' . escape(a:mapping, '\')
  let comment_pattern = '\V' . escape(substitute(&l:commentstring, '%s.*$', '', ''), '\')
  return (text_before_cursor =~? '^' . ('\v(' . comment_pattern . '\v)?') . '\s*\v' . mapping_pattern . '\v$')
endfunction

inoreabbrev <expr> <bar><bar>
          \ <SID>isAtStartOfLine('\|\|') ?
          \ '<c-o>:TableModeEnable<cr><bar><space><bar><left><left>' : '<bar><bar>'
inoreabbrev <expr> __
          \ <SID>isAtStartOfLine('__') ?
          \ '<c-o>:silent! TableModeDisable<cr>' : '__'


" ===
" === Asyncomplete
" ===
"PY LSP
if executable('pyls')
    " pip install python-language-server
    au User lsp_setup call lsp#register_server({
        \ 'name': 'pyls',
        \ 'cmd': {server_info->['pyls']},
        \ 'allowlist': ['python'],
        \ })
endif
" Tab completion
inoremap <expr> <Tab>   pumvisible() ? "\<C-n>" : "\<Tab>"
inoremap <expr> <S-Tab> pumvisible() ? "\<C-p>" : "\<S-Tab>"
inoremap <expr> <cr>    pumvisible() ? asyncomplete#close_popup() : "\<cr>"


" ===
" === IndentGuide
" ===
"enable indent guide on startup
let g:indent_guides_enable_on_vim_startup = 1


