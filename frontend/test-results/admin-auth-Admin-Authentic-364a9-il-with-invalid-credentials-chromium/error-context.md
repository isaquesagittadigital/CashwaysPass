# Page snapshot

```yaml
- generic [ref=e5]:
  - generic [ref=e6]:
    - button "Escola" [ref=e7] [cursor=pointer]
    - button "Painel administrativo" [ref=e8] [cursor=pointer]
  - img [ref=e11]
  - generic [ref=e23]:
    - generic [ref=e25]:
      - generic:
        - generic:
          - img
      - 'textbox "Ex.: user@gmail.com" [ref=e26]': admin_fake_test@naoexiste.com
    - generic [ref=e28]:
      - generic:
        - generic:
          - img
      - textbox "Informe a sua senha" [active] [ref=e29]: senha_errada
      - button [ref=e30] [cursor=pointer]:
        - img [ref=e32]
    - generic [ref=e35]:
      - checkbox "Lembrar-me" [ref=e36] [cursor=pointer]
      - generic [ref=e37] [cursor=pointer]: Lembrar-me
    - button "Acessar conta" [ref=e38] [cursor=pointer]:
      - generic [ref=e39]: Acessar conta
  - generic [ref=e40]: VERSÃO BETA 2.5
```