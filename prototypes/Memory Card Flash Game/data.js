const tirthankars = [
    { id:1, en:"Rishabhanatha", hi:"ऋषभनाथ", chinh_en:"Bull", chinh_hi:"बैल", chinh_icon:"🐂", comp_en:"Golden", comp_hi:"स्वर्ण", comp_hex:"#FFD700", aasan_en:"Standing", aasan_hi:"खड़े", aasan_icon:"🧍", moksha_en:"Sammed Shikharji", moksha_hi:"सम्मेद शिखरजी" },
    { id:2, en:"Ajitanatha", hi:"अजितनाथ", chinh_en:"Elephant", chinh_hi:"हाथी", chinh_icon:"🐘", comp_en:"Golden", comp_hi:"स्वर्ण", comp_hex:"#FFD700", aasan_en:"Standing", aasan_hi:"खड़े", aasan_icon:"🧍", moksha_en:"Sammed Shikharji", moksha_hi:"सम्मेद शिखरजी" },
    { id:3, en:"Sambhavanatha", hi:"संभवनाथ", chinh_en:"Horse", chinh_hi:"घोड़ा", chinh_icon:"🐎", comp_en:"Golden", comp_hi:"स्वर्ण", comp_hex:"#FFD700", aasan_en:"Standing", aasan_hi:"खड़े", aasan_icon:"🧍", moksha_en:"Sammed Shikharji", moksha_hi:"सम्मेद शिखरजी" },
    { id:4, en:"Abhinandananatha", hi:"अभिनंदननाथ", chinh_en:"Monkey", chinh_hi:"बंदर", chinh_icon:"🐒", comp_en:"Golden", comp_hi:"स्वर्ण", comp_hex:"#FFD700", aasan_en:"Standing", aasan_hi:"खड़े", aasan_icon:"🧍", moksha_en:"Sammed Shikharji", moksha_hi:"सम्मेद शिखरजी" },
    { id:5, en:"Sumatinatha", hi:"सुमतिनाथ", chinh_en:"Curlew Bird", chinh_hi:"चक्रवाक पक्षी", chinh_icon:"🦅", comp_en:"Golden", comp_hi:"स्वर्ण", comp_hex:"#FFD700", aasan_en:"Standing", aasan_hi:"खड़े", aasan_icon:"🧍", moksha_en:"Sammed Shikharji", moksha_hi:"सम्मेद शिखरजी" },
    { id:6, en:"Padmaprabha", hi:"पद्मप्रभ", chinh_en:"Lotus", chinh_hi:"कमल", chinh_icon:"🪷", comp_en:"Red", comp_hi:"लाल", comp_hex:"#E53935", aasan_en:"Standing", aasan_hi:"खड़े", aasan_icon:"🧍", moksha_en:"Sammed Shikharji", moksha_hi:"सम्मेद शिखरजी" },
    { id:7, en:"Suparshvanatha", hi:"सुपार्श्वनाथ", chinh_en:"Swastika", chinh_hi:"स्वस्तिक", chinh_icon:"☸️", comp_en:"Golden-Green", comp_hi:"स्वर्ण-हरित", comp_hex:"#9CCC65", aasan_en:"Standing", aasan_hi:"खड़े", aasan_icon:"🧍", moksha_en:"Sammed Shikharji", moksha_hi:"सम्मेद शिखरजी" },
    { id:8, en:"Chandraprabha", hi:"चंद्रप्रभ", chinh_en:"Moon", chinh_hi:"चंद्रमा", chinh_icon:"🌙", comp_en:"White", comp_hi:"श्वेत", comp_hex:"#F5F5F5", aasan_en:"Standing", aasan_hi:"खड़े", aasan_icon:"🧍", moksha_en:"Sammed Shikharji", moksha_hi:"सम्मेद शिखरजी" },
    { id:9, en:"Pushpadanta", hi:"पुष्पदंत", chinh_en:"Crocodile/Dolphin", chinh_hi:"मकर", chinh_icon:"🐊", comp_en:"White", comp_hi:"श्वेत", comp_hex:"#F5F5F5", aasan_en:"Standing", aasan_hi:"खड़े", aasan_icon:"🧍", moksha_en:"Sammed Shikharji", moksha_hi:"सम्मेद शिखरजी" },
    { id:10, en:"Shitalanatha", hi:"शीतलनाथ", chinh_en:"Shrivatsa", chinh_hi:"श्रीवत्स", chinh_icon:"🔯", comp_en:"Golden", comp_hi:"स्वर्ण", comp_hex:"#FFD700", aasan_en:"Standing", aasan_hi:"खड़े", aasan_icon:"🧍", moksha_en:"Sammed Shikharji", moksha_hi:"सम्मेद शिखरजी" },
    { id:11, en:"Shreyansanatha", hi:"श्रेयांसनाथ", chinh_en:"Rhinoceros", chinh_hi:"गैंडा", chinh_icon:"🦏", comp_en:"Golden", comp_hi:"स्वर्ण", comp_hex:"#FFD700", aasan_en:"Standing", aasan_hi:"खड़े", aasan_icon:"🧍", moksha_en:"Sammed Shikharji", moksha_hi:"सम्मेद शिखरजी" },
    { id:12, en:"Vasupujya", hi:"वासुपूज्य", chinh_en:"Buffalo", chinh_hi:"भैंसा", chinh_icon:"🐃", comp_en:"Red", comp_hi:"लाल", comp_hex:"#E53935", aasan_en:"Standing", aasan_hi:"खड़े", aasan_icon:"🧍", moksha_en:"Sammed Shikharji", moksha_hi:"सम्मेद शिखरजी" },
    { id:13, en:"Vimalanatha", hi:"विमलनाथ", chinh_en:"Boar", chinh_hi:"सूअर", chinh_icon:"🐗", comp_en:"Golden", comp_hi:"स्वर्ण", comp_hex:"#FFD700", aasan_en:"Standing", aasan_hi:"खड़े", aasan_icon:"🧍", moksha_en:"Sammed Shikharji", moksha_hi:"सम्मेद शिखरजी" },
    { id:14, en:"Anantanatha", hi:"अनंतनाथ", chinh_en:"Falcon/Hawk", chinh_hi:"बाज़", chinh_icon:"🦅", comp_en:"Golden", comp_hi:"स्वर्ण", comp_hex:"#FFD700", aasan_en:"Standing", aasan_hi:"खड़े", aasan_icon:"🧍", moksha_en:"Sammed Shikharji", moksha_hi:"सम्मेद शिखरजी" },
    { id:15, en:"Dharmanatha", hi:"धर्मनाथ", chinh_en:"Thunderbolt", chinh_hi:"वज्र", chinh_icon:"⚡", comp_en:"Golden", comp_hi:"स्वर्ण", comp_hex:"#FFD700", aasan_en:"Standing", aasan_hi:"खड़े", aasan_icon:"🧍", moksha_en:"Sammed Shikharji", moksha_hi:"सम्मेद शिखरजी" },
    { id:16, en:"Shantinatha", hi:"शांतिनाथ", chinh_en:"Antelope", chinh_hi:"हिरण", chinh_icon:"🦌", comp_en:"Golden", comp_hi:"स्वर्ण", comp_hex:"#FFD700", aasan_en:"Standing", aasan_hi:"खड़े", aasan_icon:"🧍", moksha_en:"Sammed Shikharji", moksha_hi:"सम्मेद शिखरजी" },
    { id:17, en:"Kunthunatha", hi:"कुंथुनाथ", chinh_en:"Goat", chinh_hi:"बकरी", chinh_icon:"🐐", comp_en:"Golden", comp_hi:"स्वर्ण", comp_hex:"#FFD700", aasan_en:"Standing", aasan_hi:"खड़े", aasan_icon:"🧍", moksha_en:"Sammed Shikharji", moksha_hi:"सम्मेद शिखरजी" },
    { id:18, en:"Aranatha", hi:"अरनाथ", chinh_en:"Fish", chinh_hi:"मछली", chinh_icon:"🐟", comp_en:"Golden", comp_hi:"स्वर्ण", comp_hex:"#FFD700", aasan_en:"Standing", aasan_hi:"खड़े", aasan_icon:"🧍", moksha_en:"Sammed Shikharji", moksha_hi:"सम्मेद शिखरजी" },
    { id:19, en:"Mallinath", hi:"मल्लिनाथ", chinh_en:"Water Pot", chinh_hi:"कलश", chinh_icon:"🏺", comp_en:"Blue", comp_hi:"नील", comp_hex:"#1E88E5", aasan_en:"Standing", aasan_hi:"खड़े", aasan_icon:"🧍", moksha_en:"Sammed Shikharji", moksha_hi:"सम्मेद शिखरजी" }, // Digambar: Male, Blue
    { id:20, en:"Munisuvrata", hi:"मुनिसुव्रत", chinh_en:"Tortoise", chinh_hi:"कछुआ", chinh_icon:"🐢", comp_en:"Black", comp_hi:"कृष्ण", comp_hex:"#424242", aasan_en:"Standing", aasan_hi:"खड़े", aasan_icon:"🧍", moksha_en:"Sammed Shikharji", moksha_hi:"सम्मेद शिखरजी" },
    { id:21, en:"Naminatha", hi:"नमिनाथ", chinh_en:"Blue Lotus", chinh_hi:"नील कमल", chinh_icon:"💠", comp_en:"Golden", comp_hi:"स्वर्ण", comp_hex:"#FFD700", aasan_en:"Seated", aasan_hi:"बैठे (पद्मासन)", aasan_icon:"🧘", moksha_en:"Sammed Shikharji", moksha_hi:"सम्मेद शिखरजी" },
    { id:22, en:"Neminatha", hi:"नेमिनाथ", chinh_en:"Conch Shell", chinh_hi:"शंख", chinh_icon:"🐚", comp_en:"Dark Blue", comp_hi:"श्याम", comp_hex:"#283593", aasan_en:"Seated", aasan_hi:"बैठे (पद्मासन)", aasan_icon:"🧘", moksha_en:"Sammed Shikharji", moksha_hi:"सम्मेद शिखरजी" },
    { id:23, en:"Parshvanatha", hi:"पार्श्वनाथ", chinh_en:"Snake", chinh_hi:"सर्प", chinh_icon:"🐍", comp_en:"Blue", comp_hi:"नील", comp_hex:"#1E88E5", aasan_en:"Seated", aasan_hi:"बैठे (पद्मासन)", aasan_icon:"🧘", moksha_en:"Sammed Shikharji", moksha_hi:"सम्मेद शिखरजी" },
    { id:24, en:"Mahavira", hi:"महावीर", chinh_en:"Lion", chinh_hi:"शेर", chinh_icon:"🦁", comp_en:"Golden", comp_hi:"स्वर्ण", comp_hex:"#FFD700", aasan_en:"Seated", aasan_hi:"बैठे (पद्मासन)", aasan_icon:"🧘", moksha_en:"Sammed Shikharji", moksha_hi:"सम्मेद शिखरजी" }
];

const uiText = {
    en: {
        headerTitle: "Tirthankar Quest", welcomeTitle: "Learn, Play & Remember!", welcomeDesc: "Discover the 24 Tirthankars through fun memory games.",
        nameLabel: "Your Name / Nickname:", modeLabel: "Choose Game Category:",
        catChinh: "Chinh (Symbol)", catComplexion: "Complexion", catAasan: "Aasan (Posture)", catMoksha: "Moksha Sthal",
        btnStart: "Start Game", btnLB: "View Leaderboard", lbTitle: "🏆 Top Players",
        thName: "Name", thCat: "Category", thTime: "Time",
        memInstr: "Flip cards to match the Tirthankar's Name with their visual attribute! (Pairs of 6 per round)",
        sortInstr: "Drag the names to arrange them from 1st to 24th Tirthankar. Colors will update after your first move!",
        alertName: "Please enter your name first!", alertIncomplete: "Some Tirthankars are not in the correct position yet."
    },
    hi: {
        headerTitle: "तीर्थंकर क्वेस्ट", welcomeTitle: "सीखें, खेलें और याद रखें!", welcomeDesc: "मजेदार गेम्स के माध्यम से 24 तीर्थंकरों को जानें।",
        nameLabel: "आपका नाम / उपनाम:", modeLabel: "गेम श्रेणी चुनें:",
        catChinh: "चिन्ह", catComplexion: "वर्ण (रंग)", catAasan: "आसन (मुद्रा)", catMoksha: "मोक्ष स्थल",
        btnStart: "खेल शुरू करें", btnLB: "लीडरबोर्ड देखें", lbTitle: "🏆 शीर्ष खिलाड़ी",
        thName: "नाम", thCat: "श्रेणी", thTime: "समय",
        memInstr: "तीर्थंकर के नाम को उनके चिन्ह/रंग/आसन से मिलाने के लिए कार्ड पलटें! (एक बार में 6 जोड़े)",
        sortInstr: "नामों को 1 से 24वें तीर्थंकर के क्रम में लगाने के लिए खींचें। पहली चाल के बाद रंग बदलेंगे!",
        alertName: "कृपया पहले अपना नाम दर्ज करें!", alertIncomplete: "कुछ तीर्थंकर अभी भी गलत स्थान पर हैं।"
    }
};