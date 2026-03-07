# Deploy-guide: mengshoel.se

## Status just nu

- [x] GitHub-repo kopplat till Vercel
- [x] Miljövariabler tillagda på Vercel
- [x] Första deployen lyckad
- [x] mengshoel.se tillagd som domän i Vercel
- [x] DNS (A-post) konfigurerad hos Loopia -> 216.198.79.1
- [ ] Väntar på att DNS sprider sig (kan ta minuter till timmar)

## Vad du behöver göra nu

### 1. Vänta på DNS-spridning

Testa med jämna mellanrum att gå till **mengshoel.se** i webbläsaren.
Du kan också gå till Vercel -> mengshoel-production -> Domains och klicka **Refresh**.
När det fungerar ser du inloggningssidan.

### 2. Verifiera att allt fungerar

När mengshoel.se laddar:

- [ ] Ser du inloggningssidan? (AJ + e-post/lösenord)
- [ ] Kan du logga in med den användare du skapade i Supabase?
- [ ] Fungerar appen som vanligt efter inloggning?

### 3. Skapa den andra användaren (om inte redan gjort)

1. Gå till **dashboard.supabase.com** -> ditt projekt
2. Klicka **Authentication** -> **Users** -> **Add user** -> **Create new user**
3. Fyll i e-post och lösenord
4. Bocka i **Auto Confirm User**

## Bra att veta

- **Automatisk deploy:** Varje gång kod pushas till GitHub (main-branchen) bygger Vercel om sidan automatiskt.
- **Miljövariabler:** Om du behöver ändra en nyckel, gå till Vercel -> Settings -> Environment Variables.
- **SSL/HTTPS:** Vercel fixar detta automatiskt. Du behöver inte göra något.
- **Sökmotorer:** Sidan är blockerad från Google/Bing via robots.txt + noindex meta-tagg.

## Inloggningsuppgifter och tjänster

| Tjänst | URL | Vad det är |
|--------|-----|------------|
| Vercel | vercel.com | Hosting (där appen körs) |
| Supabase | dashboard.supabase.com | Databas + autentisering |
| Loopia | loopia.se | Domännamn (mengshoel.se) |
| GitHub | github.com/mengwed/MengshoelProduction | Kodförråd |
