# EVAT Continuum 4.9.1

- Séparation des erreurs de capture média et d’établissement WebRTC, pour éviter le faux diagnostic « micro/caméra impossible » lorsque l’échec arrive pendant la connexion réseau.
- Les erreurs de signalisation d’offre/réponse sont affichées dans l’interface au lieu de rester uniquement dans la console.
- Diagnostic TURN plus précis, avec nombres de candidats hôte/direct et une explication qui ne conclut pas à tort que le Wi-Fi est coupé.
- Cache du service worker renouvelé et manifeste/icônes PWA inclus.
