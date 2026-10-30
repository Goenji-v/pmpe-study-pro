# Recuperação de senha — código no e-mail (configuração manual)

No Supabase, em **Authentication → Email Templates → Reset Password**, manter o link original:

```html
<a href="{{ .ConfirmationURL }}">Criar nova senha</a>
```

Para permitir a opção **Configurações → Alterar senha → Não sei a senha atual**, inserir também o código de recuperação no corpo do e-mail:

```html
<p>Seu código de confirmação:</p>
<p style="font-size:28px;font-weight:bold;letter-spacing:5px;">{{ .Token }}</p>
<p>Digite esse código no Study Pro para confirmar que o e-mail pertence a você.</p>
```

Não remover o link de recuperação: outros usuários podem precisar da rota por e-mail.
Não inventar ou armazenar códigos no cliente. O Supabase gera e valida o token com
`supabase.auth.verifyOtp({ email, token, type: "recovery" })`.
Atenção: usar este template apenas quando os fluxos de senha tiverem sido testados
em ambiente isolado. Não alterar templates de produção durante desenvolvimento.
