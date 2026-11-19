# Script Personal Data

![JavaScript](https://img.shields.io/badge/JavaScript-Vanilla-f7df1e?style=flat-square&logo=javascript&logoColor=18181b)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-7c3aed?style=flat-square)
![Browsers](https://img.shields.io/badge/Browsers-Firefox%20%7C%20Chrome%20%7C%20Edge%20%7C%20Brave-27272a?style=flat-square)

Extensão de navegador feita para eliminar o trabalho repetitivo de preencher nome, e-mail, telefone, LinkedIn, GitHub, portfólio, localização e pretensão salarial dezenas de vezes em plataformas de recrutamento diferentes (Gupy, Greenhouse, Lever, Workday, formulários próprios de empresas, entre outros) que não compartilham cadastro entre si.

Com um clique no botão flutuante no canto da tela, a extensão identifica os campos vazios da página atual, injeta os dados configurados e ainda oferece atalhos individuais de cópia para lidar com dropdowns customizados ou campos que bloqueiam preenchimento automático.

---

## Como funciona por baixo dos panos

Grande parte dos portais de vagas hoje roda em SPAs construídas com React, Next.js, Vue ou Angular. Nesses cenários, simplesmente atribuir `input.value = "valor"` não funciona como esperado: o framework mantém o estado interno sincronizado por meio de wrappers próprios e ignora mutações diretas na propriedade, fazendo o campo voltar a ficar vazio ou falhar na validação no momento do envio.

Para contornar isso, o motor de preenchimento usa o setter nativo do protótipo do DOM (`HTMLInputElement.prototype` / `HTMLTextAreaElement.prototype`):

```js
const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
setter.call(el, value);

el.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, data: value }));
el.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
el.dispatchEvent(new Event('blur', { bubbles: true, cancelable: true }));
```

Esse fluxo garante que o estado interno do componente controlado seja atualizado e que as validações vinculadas ao foco e à mudança de valor sejam disparadas corretamente.

Além disso, como o painel é injetado diretamente no DOM de páginas de terceiros (muitas vezes com resets agressivos de CSS, Tailwind ou Bootstrap), o contêiner da extensão utiliza `all: initial`, classes prefixadas (`afv-*`) e `z-index: 999999` para isolar o layout e a tipografia sem vazar estilos para o site hospedeiro.

---

## Funcionalidades

- **Preenchimento seletivo:** varre `<input>` visíveis e `<textarea>` da página (incluindo iframes de mesma origem) cruzando `placeholder`, `name`, `id`, `aria-label`, `autocomplete` e `<label>` associados em português e inglês.
- **Nunca sobrescreve o que você já digitou:** apenas campos vazios são preenchidos, recebendo uma borda verde por 1,5 segundo para confirmação visual.
- **Separação automática de nome e sobrenome:** se o formulário pedir *First Name* / *Last Name* (ou *Primeiro nome* / *Sobrenome*), a extensão divide o `Nome completo` automaticamente.
- **Botão de copiar por campo:** útil para selects customizados, máscaras rígidas ou formulários que exigem colar o valor manualmente.
- **Backup em JSON:** exporte e importe suas configurações em um arquivo `.json` para levar seus dados para outro navegador ou máquina.
- **Sem dependências externas:** JavaScript e CSS puros em Manifest V3, compatível com Firefox e navegadores baseados em Chromium.

---

## Instalação

### Firefox (Desktop e Android)

Instale diretamente pela página oficial da extensão no Firefox Add-ons (ou abrindo o arquivo `.xpi` assinado, caso tenha baixado pelas Releases).

### Chrome, Edge e Brave (Desktop)

1. Baixe ou clone este repositório.
2. Abra `chrome://extensions` (ou `edge://extensions` / `brave://extensions`).
3. Ative o **Modo do desenvolvedor** no canto superior direito.
4. Clique em **Carregar sem compactação** e selecione a pasta do projeto.

> **Nota sobre Android:** no Android, a extensão funciona no **Firefox para Android** e em navegadores Chromium com suporte a extensões (como Kiwi Browser). O Chrome e o Edge oficiais para Android não oferecem suporte a extensões.

---

## Privacidade e Segurança

- **Zero tráfego de rede:** nenhum dado digitado na extensão é enviado para servidores externos, APIs de terceiros ou serviços de telemetria. Todo o perfil fica armazenado exclusivamente no `storage.local` do seu próprio navegador.
- **Execução sob demanda:** a extensão não preenche nenhum formulário automaticamente em segundo plano — ela só interage com os campos da página quando você clica em **Preencher inputs**.
- **Cuidados recomendados:**
  - Como os dados ficam salvos localmente no perfil do navegador (e no arquivo `.json` caso você exporte um backup), evite salvar informações pessoais em computadores públicos ou perfis compartilhados.
  - Sempre revise os campos preenchidos antes de enviar a candidatura, especialmente em formulários com rótulos ambíguos.
