WO IST WAS? – Haus-Suchmaschine

Version 1:
- Gegenstände suchen
- Räume und genaue Orte anzeigen
- Suchbegriffe hinterlegen
- Einträge hinzufügen, bearbeiten, löschen
- Daten lokal im Browser speichern
- Sicherung als JSON exportieren / importieren
- PWA-Unterstützung für iPhone-Homescreen

WICHTIG:
Diese Version speichert noch nicht automatisch zwischen mehreren Geräten.
Dafür wäre als nächster Schritt eine gemeinsame Cloud-Datenbank sinnvoll.

Zum Testen am Computer:
1. Ordner entpacken.
2. In diesem Ordner einen kleinen Webserver starten, z. B.:
   python3 -m http.server 8000
3. Im Browser http://localhost:8000 öffnen.

Für iPhone:
Die Dateien müssen über HTTPS bereitgestellt werden (z. B. GitHub Pages,
Netlify oder einen anderen statischen Webhoster). Danach in Safari öffnen,
Teilen → "Zum Home-Bildschirm".
