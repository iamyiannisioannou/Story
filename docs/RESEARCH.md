# Καταγραφή προτύπων: τι έχει επαληθευτεί και τι λείπει

Ημερομηνία καταγραφής: 2026-11-08.
Πηγές: δημόσιες σελίδες του tradezella.com (home, /features, /pricing, /trade-replay, /backtesting, /zella-ai, /brokersupport) και οι εικόνες προϊόντος που φιλοξενούν. Επίσης η δημόσια σελίδα του chrlockguard.com.
**Δεν** έχει χρησιμοποιηθεί λογαριασμός, help center (intercom.help, μπλοκαρισμένο) ή βίντεο.

Κάθε οθόνη έχει ένα από τρία επίπεδα επαλήθευσης:
- ✅ **Επαληθευμένο οπτικά:** υπάρχει επίσημη εικόνα της οθόνης.
- 📝 **Επαληθευμένο μόνο από κείμενο:** η λειτουργία περιγράφεται, αλλά δεν υπάρχει εικόνα.
- ❓ **Δεν έχει επαληθευτεί:** χρειάζεται υλικό από εσάς.

## TradeZella

| Οθόνη / λειτουργία | Επίπεδο | Τι είδα | Κατάσταση στο Kairos |
|---|---|---|---|
| Dashboard | ✅ | Σκούρο sidebar μόνο με εικονίδια. Header: τίτλος, $, Filters, Date range, All Accounts, καμπανάκι. «Good morning», Last imported, Edit Widgets, Import Trades. 5 KPI: Net P&L, Trade Expectancy, Profit Factor (ημικύκλιο), Win % (δαχτυλίδι), Avg win/loss (μπάρα). Zella Score (ραντάρ), Daily Net Cumulative P&L (περιοχή πράσινη/κόκκινη), Net Daily P&L (μπάρες). Open Positions / Recent Trades, μηνιαίο ημερολόγιο | Υλοποιημένο. Λείπουν Edit Widgets και Open Positions (δεν έχουμε ανοιχτές θέσεις χωρίς sync) |
| Επιλογέας λογαριασμών | ✅ | Λίστα με checkbox, «All Accounts», «My accounts» | Υλοποιημένο |
| Πίνακας συναλλαγών | ✅ | Open date, Symbol, Net P&L, Status (WIN/LOSS), Net ROI, Strategy (chip), Zella Scale | Υλοποιημένο. Το «R scale» είναι δική μας ερμηνεία της κλίμακας |
| Playbooks (λίστα) | ✅ | My/Shared playbooks, λίστα/πλέγμα, Templates, Create playbook, ταξινόμηση. Κάρτες με εικονίδιο, trades, Private/Shared, win rate (δαχτυλίδι), Net P&L, περιγραφή. Επεκτεταμένη κάρτα: profit factor, missed trades, expectancy, avg winner/loser | Υλοποιημένο χωρίς Shared, Templates και missed trades |
| Reports | ✅ | Αριστερό μενού: Overview, Date & Time (Days, Weeks, Months, Trade time, Trade duration), Price & Quantity (Price, Volume, Instrument), Options, Risk (R-Multiple, Position size). «Your stats»: best/lowest month και μεγάλη λίστα στατιστικών. Πίνακας Duration με μπάρες | Υλοποιημένο: Overview, ημέρες, εβδομάδες, μήνες, ώρα, διάρκεια, symbol, side, playbook, setups, mistakes, R. Λείπουν Price, Volume, Options, Position size |
| Widgets (Account balance, Current streak) | ✅ (αποσπάσματα) | «Account Balance & P&L», «Current streak» σε ημέρες/trades | Δεν έχουν υλοποιηθεί |
| Mentor dashboard | ✅ (μάρκετινγκ) | Καμπύλες πολλών μαθητών | Δεν έχει υλοποιηθεί (απαιτεί hosting και login) |
| Import / Connect | ✅ (μάρκετινγκ) | Κουμπιά «Connect» και «+ Upload file», λογότυπα brokers | File upload υλοποιημένο. Το Connect όχι |
| Trade Replay: επιλογή trade | ✅ | Modal «Select a Trade to Replay» με αναζήτηση, ημερομηνία, ώρα, symbol, P&L και play | Όχι (χρειάζεται market data) |
| Trade Replay: player | 📝 | Tick-by-tick, ταχύτητα, time & sales, Level 2, πολλαπλά timeframes | Όχι |
| Backtesting | 📝 | Bar-by-bar, 1-second charts, playbook library, AI backtesting σε φυσική γλώσσα | Όχι |
| Zella AI / Agents | 📝 | Συνομιλία, pattern detection, Habit, Risk, Sentiment και Custom agents, credits | Όχι (χρειάζεται API key) |
| Prop Firm Sync | 📝 | Profit targets, daily drawdown, consistency rules | Μερικώς, μέσω Lock Guard (daily loss/profit) |
| Notebook | 📝 | Templates, trading plans, recap losses, share | Υλοποιημένο: σημείωση ανά ημέρα, templates, mood, screenshots |
| Day view / Daily journal | ❓ | Δεν υπάρχει εικόνα | Υλοποιημένο με δική μας διάταξη |
| Λεπτομέρεια συναλλαγής | ❓ | Δεν υπάρχει εικόνα | Υλοποιημένο με δική μας διάταξη |
| Settings, Add Trade modal, Filters dropdown | ❓ | Δεν υπάρχει εικόνα | Δική μας διάταξη |
| Sidebar ανοιχτό (με ετικέτες) | ❓ | Μόνο η κλειστή μορφή | Δική μας ανοιχτή μορφή |

## CHR Lock Guard

| Λειτουργία | Επίπεδο | Κατάσταση |
|---|---|---|
| Κανόνες: κλείδωμα μετά από N wins, losses, break-evens ή trades, και ώρα κλειδώματος ΝΥ | 📝 | Υλοποιημένο. Πρόσθετα: συνεχόμενες απώλειες, ημερήσιο όριο ζημίας και στόχος κέρδους |
| Journal-ημερολόγιο με στήλη εβδομάδας | ✅ (μικρή εικόνα) | Υλοποιημένο στο ημερολόγιο |
| Πραγματικό κλείδωμα πλατφόρμας (TradeSea/Tradovate) | 📝 | **Όχι.** Χρειάζεται desktop helper (βλ. INTEGRATIONS.md) |
| Psychology, Study | 📝 | Μερικώς: mood στο Notebook. Το Study δεν υπάρχει |

## Υλικό που χρειάζομαι από εσάς (κατά προτεραιότητα)

1. **Λεπτομέρεια συναλλαγής** στο TradeZella: όλα τα tabs, πλήρες scroll.
2. **Day View / Daily Journal**: μια ημέρα ανοιχτή.
3. **Sidebar ανοιχτό**, με όλες τις ετικέτες του μενού.
4. **Add Trade / Import**: κάθε βήμα της ροής.
5. **Filters dropdown** και **Date range** ανοιχτά.
6. **Reports**: κάθε υποκατηγορία, ιδίως τα Win vs Loss Days και Compare, αν υπάρχουν.
7. **Settings**: όλες οι καρτέλες.
8. **Ένα πραγματικό CSV** από Tradovate (Performance report). Μπορείτε να σβήσετε ποσά ή να κρατήσετε 2–3 γραμμές. Με αυτό θα επαληθεύσω τον importer.
9. Αν έχετε πρόσβαση: **Replay, Backtesting, Zella AI**, σε καταγραφή οθόνης.
