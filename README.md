# Kairos Journal

Προσωπικό trading journal: journal και analytics στο ύφος του TradeZella, μαζί με ημερήσιους κανόνες κλειδώματος στο ύφος του CHR Lock Guard.
Είναι ανεξάρτητη υλοποίηση. Δεν σχετίζεται με το TradeZella ή το CHR Lock Guard και δεν χρησιμοποιεί κώδικα, λογότυπα ή γραφικά τους.
Το όνομα «Kairos Journal» είναι προσωρινό και αλλάζει από τη σταθερά `APP_NAME` (`src/components/Layout.jsx`) και το `index.html`.

## Τι λειτουργεί (Στάδιο 1)

- **Dashboard:**
  - KPI: Net P&L, expectancy, profit factor, win %, avg win/loss
  - Kairos Score: δικός μας, τεκμηριωμένος τύπος
  - Καμπύλη σωρευτικού P&L και ημερήσιες μπάρες
  - Πρόσφατα trades και ημερολόγιο με στήλη εβδομάδας
- **Day View:** ημέρες με P&L, ενδοημερήσια καμπύλη, στατιστικά, σημείωση και screenshots ανά ημέρα.
- **Trade View:** ταξινόμηση, σελιδοποίηση, μαζική διαγραφή, export CSV.
- **Λεπτομέρεια συναλλαγής:**
  - επεξεργασία
  - playbook με checklist κανόνων
  - setups, mistakes και tags
  - βαθμολογία, σημειώσεις, reviewed
  - screenshots με drag & drop ή επικόλληση
  - μετάβαση στο προηγούμενο ή επόμενο trade
- **Notebook:** σημείωση ανά ημέρα, templates, mood, screenshots.
- **Reports:** Overview με περίπου 35 στατιστικά, και ανάλυση ανά ημέρα εβδομάδας, εβδομάδα, μήνα, ώρα, διάρκεια, symbol, side, playbook, setup, mistake και R-multiple.
- **Playbooks:** κάρτες ή λίστα, κανόνες, στατιστικά και σελίδα λεπτομέρειας.
- **Lock Guard:**
  - κανόνες ανά λογαριασμό: max trades, wins, losses, BE, συνεχόμενες απώλειες, ημερήσια ζημία/στόχος, ώρα κλειδώματος, ζώνη ώρας
  - ζωντανή κατάσταση και ιστορικό κλειδωμάτων
  - endpoint `/api/lock-status`
- **Import:**
  - Tradovate Performance CSV (ο importer δεν έχει ελεγχθεί ακόμη σε πραγματικό αρχείο)
  - οποιοδήποτε CSV με αντιστοίχιση στηλών
  - προεπισκόπηση, αποφυγή διπλοεγγραφών, αναίρεση εισαγωγής
- **Accounts:** πολλοί λογαριασμοί, αρχειοθέτηση, επιλογέας «All Accounts» με συνδυασμούς.
- **Settings:** όνομα, ζώνη ώρας, tags, JSON backup, προαιρετικός **demo** λογαριασμός. Ο demo λογαριασμός είναι ρητά σημασμένος και τα δεδομένα του είναι γεννημένα, όχι πραγματικά.
- **Αποθήκευση:** SQLite (`data/journal.db`) και screenshots στο `data/uploads/`.

**Δεν λειτουργούν ακόμη**: Trade Replay, Backtesting, AI Analysis, Mentor Sharing, broker sync και πραγματικό κλείδωμα της πλατφόρμας.
Στην εφαρμογή εμφανίζονται ως «not connected», με εξήγηση τι χρειάζονται. Λεπτομέρειες στο [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md).
Για το τι έχει επαληθευτεί από το πρότυπο, δείτε το [docs/RESEARCH.md](docs/RESEARCH.md).

## Εκτέλεση στον υπολογιστή σας

Απαιτείται Node.js 22.13 ή νεότερο.

```bash
npm install
npm run build
npm start            # http://127.0.0.1:3001
```

Για ανάπτυξη: `npm run dev`, που ανοίγει το http://localhost:5173 με hot reload.
Για tests: `npm test`.

Με Docker:

```bash
docker compose up -d --build   # http://127.0.0.1:3001, δεδομένα στο ./data
```

Ο server ακούει μόνο στο `127.0.0.1` και δεν έχει login. **Μην** τον εκθέσετε στο internet πριν προστεθεί αυθεντικοποίηση.

## Υπολογισμοί

- **Win %** = κερδοφόρα ÷ (κερδοφόρα + ζημιογόνα). Τα break-even εξαιρούνται.
- **Profit factor** = μικτά κέρδη ÷ |μικτές ζημίες|.
- **Expectancy** = Net P&L ÷ αριθμός trades.
- **R-multiple** = Net P&L ÷ planned risk.
- **Η ημέρα** ορίζεται από την ώρα κλεισίματος της συναλλαγής, στη ζώνη ώρας των Settings.
- **P&L από τιμές** = (έξοδος − είσοδος) × ποσότητα × multiplier, με αντίθετο πρόσημο για short, μείον τα fees.
  Για futures ο multiplier προκύπτει από το symbol: MES 5, MNQ 2, ES 50, NQ 20 κ.λπ.

Όλοι οι τύποι βρίσκονται στο `shared/metrics.js`, μαζί με tests.
