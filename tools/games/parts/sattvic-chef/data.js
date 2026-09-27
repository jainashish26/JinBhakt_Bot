/* Identity + rules for Sattvic Chef. */
var GAME_ID = 'sattvic-chef';
var LB_KEY = 'jinbhakt:kids:leaderboard:v1';
var PREF_KEY = 'jinbhakt:kids:prefs:v1';
var LB_MAX = 20;

/** Higher score wins; more correct answers breaks a tie. */
var LB_CMP = function (a, b) {
  return (b.score - a.score) ||
         (((b.meta && b.meta.correct) || 0) - ((a.meta && a.meta.correct) || 0)) ||
         (a.duration - b.duration) ||
         (b.ts - a.ts);
};

var ROUNDS = [8, 16, 0];        // 0 === "all"
var BASE = 10, STREAK_MAX = 5, STREAK_STEP = 2;

/* Food categories — used for the review screen and the teaching notes. */
var FCATS = [
  ['fruitAbove', '🍎', 'Above-ground fruits', 'ऊपर फलने वाले फल'],
  ['vegAbove',   '🥬', 'Above-ground vegetables', 'ऊपर होने वाली सब्ज़ी'],
  ['grain',      '🌾', 'Grains & flours', 'अन्न और आटा'],
  ['pulse',      '🫘', 'Pulses, seeds & nuts', 'दाल, बीज और मेवा'],
  ['dairy',      '🥛', 'Dairy', 'दुग्ध उत्पाद'],
  ['leafy',      '🌿', 'Leafy greens', 'पत्तेदार साग'],
  ['root',       '🥔', 'Root vegetables', 'कंद-मूल सब्ज़ी'],
  ['anantkay',   '🕸️', 'Anantkāy · many-souled', 'अनंतकाय'],
  ['ekbeej',     '🫒', 'One-seeded fruits', 'एक-बीज फल'],
  ['animal',     '🍯', 'Meat, fish, egg & honey', 'मांस, मछली, अंडा और मधु'],
  ['fermented',  '🫙', 'Fermented & stale', 'किण्वित और बासी'],
  ['prohibited', '🌙', 'Alcohol & after sunset', 'मदिरा और रात्रि भोजन']
];

/* Row: [id, cat, jain(1/0), level('kids'|'adults'|'both'), svg,
         enName, hiName, enWhy, hiWhy, note(optional)]
   `level` filters the pool: the kids' round takes 'kids' + 'both',
   the adults' round takes everything. */
var FOODS = [
['apple','fruitAbove',1,'both','fruitRound','Apple','सेब','Grown above ground and picked without harming the tree.','पेड़ से बिना हानि पहुँचाए तोड़ा जाता है, वृक्ष सुरक्षित रहता है।'],
['banana','fruitAbove',1,'both','fruitLong','Banana','केला','The plant keeps living after the fruit is cut.','फल कटने के पश्चात भी पौधा जीवित रहता है।'],
['mango','fruitAbove',1,'both','fruitRound','Mango','आम','Ripens on the tree and is picked without injury.','पेड़ पर पकता है और बिना चोट के तोड़ा जाता है।'],
['grapes','fruitAbove',1,'both','podSeeds','Grapes','अंगूर','Plucked from a vine that goes on growing.','बेल से तोड़े जाते हैं, बेल बढ़ती रहती है।'],
['papaya','fruitAbove',0,'adults','fruitLong','Papaya','पपीता','Holds countless tiny seeds, so careful Jains avoid it.','इसमें असंख्य सूक्ष्म बीज होते हैं, इसलिए सावधान जैन इसे त्यागते हैं।'],
['guava','fruitAbove',0,'adults','fruitRound','Guava','अमरूद','An anantkāy fruit sheltering many tiny lives.','अनंतकाय फल, जिसमें अनेक सूक्ष्म जीव रहते हैं।'],
['pomegranate','fruitAbove',1,'both','podSeeds','Pomegranate','अनार','Seeds are many, yet the tree is unharmed when picked.','बीज अनेक हैं, पर तोड़ते समय वृक्ष को हानि नहीं होती।'],
['orange','fruitAbove',1,'both','fruitRound','Orange','संतरा','Grows above ground on a lasting tree.','स्थायी वृक्ष पर ज़मीन से ऊपर फलता है।'],
['pear','fruitAbove',1,'both','fruitLong','Pear','नाशपाती','Picked ripe, without ending the plant.','पका तोड़ा जाता है, पौधे का अंत नहीं होता।'],
['coconut','fruitAbove',1,'both','nutShell','Coconut','नारियल','Falls or is cut from a tall palm, no uprooting.','ऊँचे ताड़ से गिरता या कटा है, जड़ से नहीं निकाला जाता।'],
['custardApple','fruitAbove',0,'adults','fruitRound','Custard apple','शरीफ़ा','Many-seeded; avoided by the strictest observers.','बहु-बीज वाला; अति सावधानी रखने वाले इसे त्यागते हैं।'],
['tomato','vegAbove',1,'both','fruitRound','Tomato','टमाटर','A fruiting vine cut above the soil.','बेल का फल, जो मिट्टी से ऊपर काटा जाता है।'],
['brinjal','vegAbove',1,'both','fruitLong','Brinjal','बैंगन','Picked from a plant that keeps growing.','ऐसे पौधे से तोड़ा जाता है जो बढ़ता रहता है।'],
['okra','vegAbove',1,'both','fruitLong','Ladyfinger','भिंडी','Cut above ground, the plant survives.','ज़मीन के ऊपर कटती है, पौधा बचा रहता है।'],
['bitterGourd','vegAbove',1,'both','fruitLong','Bitter gourd','करेला','Grows on a climbing vine above the soil.','बेल पर ज़मीन से ऊपर उगता है।'],
['bottleGourd','vegAbove',1,'both','fruitLong','Bottle gourd','लौकी','A creeper fruit, harvested without uprooting.','लता का फल, जड़ निकाले बिना काटा जाता है।'],
['cabbage','vegAbove',1,'both','leafCluster','Cabbage','पत्ता गोभी','Cut at the head, not pulled from the root.','सिर काटा जाता है, जड़ से नहीं उखाड़ा जाता।'],
['cauliflower','vegAbove',1,'both','leafCluster','Cauliflower','फूल गोभी','The flower head is cut above ground.','फूल का भाग ज़मीन के ऊपर काटा जाता है।'],
['pumpkin','vegAbove',1,'both','fruitRound','Pumpkin','कद्दू','Grown on a spreading vine.','फैलती बेल पर उगता है।'],
['greenChilli','vegAbove',1,'both','fruitLong','Green chilli','हरी मिर्च','Plucked from a standing plant.','खड़े पौधे से तोड़ी जाती है।'],
['clusterBeans','vegAbove',1,'both','podSeeds','Cluster beans','ग्वार फली','A pod picked above the soil.','फलियाँ ज़मीन के ऊपर तोड़ी जाती हैं।'],
['rice','grain',1,'both','grainEar','Rice','चावल','A grain harvested from the top of the stalk.','बाली के सिरे से काटा जाने वाला अन्न।'],
['wheat','grain',1,'both','grainEar','Wheat','गेहूँ','Cut at the ear; the seed itself is the food.','बाली काटकर खाया जाता है, बीज ही भोजन है।'],
['roti','grain',1,'both','rotiDisc','Wheat roti','गेहूँ की रोटी','Made from harvested grain already gathered.','पहले से कटे और संगृहीत अन्न से बनती है।'],
['maize','grain',1,'both','grainEar','Maize','मक्का','Picked from the cob above ground.','भुट्टे से ज़मीन के ऊपर तोड़ा जाता है।'],
['jowar','grain',1,'both','grainEar','Jowar','ज्वार','A millet reaped from the standing crop.','खड़ी फसल से काटा जाने वाला मोटा अन्न।'],
['bajra','grain',1,'both','grainEar','Bajra','बाजरा','Harvested as seed, the plant is not uprooted.','बीज रूप में काटा जाता है, पौधा नहीं उखाड़ा जाता।'],
['besan','grain',1,'both','bowlDal','Gram flour','बेसन','Ground from already harvested chickpeas.','पहले से कटे चनों को पीसकर बनता है।'],
['poha','grain',1,'both','grainEar','Flattened rice','पोहा','Rice pressed flat after harvesting.','कटाई के पश्चात चावल को कूटकर बनाया जाता है।'],
['moongDal','pulse',1,'both','bowlDal','Moong dal','मूँग दाल','A seed harvested without ending the plant.','पौधे का अंत किए बिना लिया गया बीज।'],
['toorDal','pulse',1,'both','bowlDal','Toor dal','अरहर दाल','Pulses are seeds, gathered above the soil.','दालें बीज हैं, जो मिट्टी से ऊपर एकत्र होती हैं।'],
['chana','pulse',1,'both','podSeeds','Chickpea','चना','A legume pod, the plant is left standing.','फलीदार अन्न, पौधा खड़ा रह जाता है।'],
['rajma','pulse',1,'both','podSeeds','Kidney bean','राजमा','Harvested from the pod, not from the root.','फली से लिया जाता है, जड़ से नहीं।'],
['almonds','pulse',1,'both','nutShell','Almonds','बादाम','Nuts fall or are picked from a living tree.','मेवा जीवित वृक्ष से गिरता या तोड़ा जाता है।'],
['peanuts','pulse',1,'kids','nutShell','Peanuts','मूँगफली','A legume dug once the crop is finished, widely accepted.','फसल समाप्त होने पर खोदी जाने वाली दाल, जिसे सामान्यतः स्वीकार किया जाता है।','Some strict families avoid peanuts because they ripen underground — ask your elders.'],
['sesame','pulse',1,'both','podSeeds','Sesame','तिल','A tiny seed shaken from a dry pod.','सूखी फली से झड़ने वाले सूक्ष्म बीज।'],
['uradDal','pulse',1,'both','bowlDal','Urad dal','उड़द दाल','Ground and cooked as a harvested seed.','कटे हुए बीज को पीसकर पकाया जाता है।'],
['milk','dairy',1,'both','milkJug','Milk','दूध','Taken without harming the cow.','गाय को हानि पहुँचाए बिना लिया जाता है।'],
['ghee','dairy',1,'both','gheePot','Ghee','घी','Clarified from milk, a treasured Jain food.','दूध से बना, जैन भोजन की प्रिय वस्तु।'],
['curd','dairy',1,'both','bowlDal','Curd','दही','Set from milk; many families take it only before sunset.','दूध से जमाया जाता है; अनेक परिवार इसे केवल सूर्यास्त से पूर्व लेते हैं।','Curd is set overnight, so it is often avoided after sunset.'],
['buttermilk','dairy',1,'both','milkJug','Buttermilk','छाछ','Churned from curd and drunk fresh.','दही मथोकर बनाई जाती है और ताज़ी पी जाती है।'],
['paneer','dairy',1,'both','bowlDal','Paneer','पनीर','Made from milk and eaten the same day.','दूध से बनाया और उसी दिन खाया जाता है।'],
['khoya','dairy',0,'adults','bowlDal','Khoya','मावा','Milk reduced and stored, so it is often avoided.','दूध को गाढ़ा कर संचित किया जाता है, अतः प्रायः त्याग किया जाता है।'],
['spinach','leafy',1,'kids','leafCluster','Spinach','पालक','Leaves cut above ground.','पत्ते ज़मीन के ऊपर काटे जाते हैं।'],
['methi','leafy',1,'kids','leafCluster','Fenugreek leaves','मेथी','A leafy green, set aside on some fast days.','पत्तेदार साग; कुछ व्रत दिनों में इसे अलग रखा जाता है।','Many families avoid leafy greens on fasting days such as Ayambil.'],
['coriander','leafy',1,'kids','leafCluster','Coriander','धनिया','Plucked as leaves, the root is left in the soil.','पत्ते तोड़े जाते हैं, जड़ मिट्टी में रह जाती है।'],
['curryLeaf','leafy',1,'both','leafCluster','Curry leaves','कड़ी पत्ता','Leaves stripped from a living branch.','जीवित टहनी से पत्ते निकाले जाते हैं।'],
['bananaLeaf','leafy',1,'both','leafCluster','Banana leaf','केले का पत्ता','Used as a plate, cut without felling the tree.','थाल के रूप में प्रयोग होता है, पेड़ काटे बिना काटा जाता है।'],
['amaranth','leafy',0,'adults','leafCluster','Amaranth greens','चौलाई','A whole-plant green; strict observers set it aside.','पूरा पौधा उपयोग होता है; अति सावधानी वाले इसे त्यागते हैं।'],
['potato','root',0,'both','rootBulb','Potato','आलू','Digging it up ends the whole plant and disturbs the life within that soil.','इसे खोदने से पूरा पौधा नष्ट होता है और उस मिट्टी में बसा जीवन हिलता है।'],
['onion','root',0,'both','rootBulb','Onion','प्याज','Uprooting kills the plant, and it is counted among the anantkāy foods.','उखाड़ने से पौधा मरता है, और इसे अनंतकाय में भी गिना जाता है।'],
['garlic','root',0,'both','rootBulb','Garlic','लहसुन','A root crop, traditionally held to disturb a calm and meditative mind.','यह कंद-फसल है; परंपरा में इसे शांत और ध्यानस्थ मन में विघ्न डालने वाला माना जाता है।'],
['carrot','root',0,'both','rootTaper','Carrot','गाजर','Pulling one carrot ends the life of the whole plant.','एक गाजर खींचने से पूरे पौधे का जीवन समाप्त हो जाता है।'],
['radish','root',0,'both','rootTaper','Radish','मूली','Grown underground, so harvesting destroys the plant.','ज़मीन के नीचे उगती है, इसलिए कटाई में पौधा नष्ट हो जाता है।'],
['beetroot','root',0,'both','rootBulb','Beetroot','चुकंदर','A root that must be uprooted to be eaten.','यह जड़ है, जिसे खाने हेतु उखाड़ना ही पड़ता है।'],
['ginger','root',0,'adults','rootTaper','Fresh ginger','ताज़ा अदरक','An underground stem; the fresh root is avoided, dry powder is often allowed.','यह भूमिगत तना है; ताज़ी जड़ त्याग की जाती है, सूखा चूर्ण प्रायः स्वीकार है।'],
['sweetPotato','root',0,'both','rootBulb','Sweet potato','शकरकंद','Uprooted whole, so the plant cannot live on.','पूरा उखाड़ा जाता है, इसलिए पौधा जीवित नहीं रह पाता।'],
['turnip','root',0,'both','rootBulb','Turnip','शलजम','A root vegetable harvested by pulling it out of the ground.','ज़मीन से खींचकर निकाली जाने वाली कंद सब्ज़ी।'],
['colocasia','root',0,'both','rootBulb','Colocasia','अरबी','A tuber dug whole from the earth.','पूरी कंद जो मिट्टी से खोदकर निकाली जाती है।'],
['fig','anantkay',0,'both','fruitRound','Fig','अंजीर','Houses countless tiny insects within, so careful Jains set it aside.','इसके भीतर असंख्य सूक्ष्म कीट रहते हैं, इसलिए सावधान जैन इसे अलग रखते हैं।'],
['banyanFruit','anantkay',0,'both','fruitRound','Banyan fig','बरगदी','An anantkāy fruit holding innumerable small beings.','अनंतकाय फल, जिसमें असंख्य छोटे जीव बसे होते हैं।'],
['peepalFruit','anantkay',0,'both','fruitRound','Peepal fruit','पीपल','Countless lives shelter inside this tiny fruit.','इस सूक्ष्म फल के भीतर असंख्य जीव आश्रय लेते हैं।'],
['gular','anantkay',0,'adults','fruitRound','Cluster fig','गूलर','One of the five udumbar fruits traditionally set aside.','परंपरा में अलग रखे जाने वाले पाँच उदुम्बर फलों में से एक।'],
['katthar','anantkay',1,'kids','fruitRound','Jackfruit','कठहल','Many-seeded but harvested above ground; many families accept it.','बीज अनेक हैं पर ज़मीन से ऊपर तोड़ा जाता है; अनेक परिवार इसे स्वीकारते हैं।','Practice varies — some families count it among the many-souled fruits.'],
['mushroom','anantkay',0,'both','mushroomCap','Mushroom','कुछ','Grows in decay, and is held to be unclean for a sāttvic table.','सड़न में उगता है, और सात्त्विक भोजन हेतु अशुद्ध माना जाता है।'],
['umbrella','anantkay',0,'adults','mushroomCap','Toadstool','विषैला फफूंद','A fungus bred on rot, avoided entirely.','सड़न पर पलने वाला फफूंद, जिसे पूर्णतः त्याग किया जाता है।'],
['bery','anantkay',0,'adults','fruitRound','Ber','बेर','A many-seeded wild fruit set aside during observances.','अनंत बीज वाला वन फल, जिसे अनुष्ठान काल में अलग रखा जाता है।'],
['badamKat','ekbeej',0,'adults','nutShell','Single-kernel nut','एक-गिरी मेवा','One-seeded, and given up during strict observance.','एक-बीज वाला, जिसे कठोर अनुष्ठान में त्याग दिया जाता है।'],
['aamKachcha','ekbeej',0,'adults','fruitRound','Unripe mango','कच्चा आम','A one-seeded fruit set aside on ek-bīj days.','एक-बीज फल, जिसे एक-बीज व्रत के दिनों में अलग रखा जाता है।'],
['plum','ekbeej',0,'adults','fruitRound','Plum','आलूबुखारा','Single-seeded, and avoided when the ek-bīj vow is taken.','एक-बीज वाला; एक-बीज व्रत लेने पर त्याग किया जाता है।'],
['peach','ekbeej',0,'adults','fruitRound','Peach','आड़ू','One hard stone inside, so it is set aside.','भीतर एक ही कठोर गुठली, अतः इसे अलग रखा जाता है।'],
['date','ekbeej',1,'kids','fruitLong','Date','खजूर','Single-seeded, yet widely accepted outside strict observance.','एक-बीज वाला, तथापि कठोर अनुष्ठान के बाहर सामान्यतः स्वीकार्य।','Some families set dates aside during ek-bīj or Ayambil periods.'],
['chicken','animal',0,'both','boneMeat','Chicken','मुर्ग़ा','Meat requires killing an animal, and ahimsa is the very heart of Jainism.','मांस हेतु पशु का वध करना पड़ता है, और अहिंसा ही जैन धर्म का हृदय है।'],
['mutton','animal',0,'both','boneMeat','Mutton','मटन','Flesh taken by ending a life — never part of a Jain table.','प्राण लेकर प्राप्त मांस — जैन भोजन में इसका कभी स्थान नहीं।'],
['fish','animal',0,'both','boneMeat','Fish','मछली','A living being of the water; taking it is direct himsa.','जल में रहने वाला जीव; इसे लेना सीधी हिंसा है।'],
['prawn','animal',0,'both','boneMeat','Prawn','झींगा','A water creature killed for food.','भोजन हेतु मारा गया जल-जीव।'],
['egg','animal',0,'both','eggOval','Egg','अंडा','May hold a developing life, so it is wholly avoided.','इसमें विकसित होता जीवन हो सकता है, अतः पूर्णतः त्याग किया जाता है।'],
['honey','animal',0,'both','honeyComb','Honey','शहद','Bees labour for it, and taking it harms the hive.','इसके लिए मधुमक्खियाँ श्रम करती हैं, और इसे लेने से छत्ते को हानि होती है।'],
['gelatin','animal',0,'adults','boneMeat','Gelatin','जेलाटिन','Drawn from animal bone and hide.','पशु की हड्डी और खाल से प्राप्त।'],
['lard','animal',0,'adults','boneMeat','Lard','पशु-वसा','Rendered animal fat, always excluded.','पिघलाई गई पशु वसा, सदैव वर्जित।'],
['idli','fermented',0,'adults','bowlDal','Idli','इडली','A batter left overnight to rise, so fermentation is unavoidable.','रात भर रखकर उठाया गया घोल, अतः किण्वन अनिवार्य है।'],
['dosa','fermented',0,'adults','rotiDisc','Dosa','डोसा','Made from the same fermented batter as idli.','इडली जैसे ही किण्वित घोल से बनता है।'],
['dhokla','fermented',0,'adults','bowlDal','Dhokla','ढोकला','Leavened and set overnight before steaming.','भाप से पकाने से पूर्व खमीर उठाकर रात भर रखा जाता है।'],
['bread','fermented',0,'adults','rotiDisc','Bread','ब्रेड','Raised with yeast, a living culture.','खमीर से फुलाया जाता है, जो एक जीवित संवर्धन है।'],
['khaman','fermented',0,'adults','bowlDal','Khaman','खमण','A leavened batter, therefore set aside.','खमीरयुक्त घोल, इसलिए अलग रखा जाता है।'],
['leftoverRice','fermented',0,'both','bowlDal','Overnight rice','बासी चावल','Kept food grows microorganisms, so fresh food is preferred.','रखा भोजन सूक्ष्मजीव पालता है, अतः ताज़ा भोजन श्रेष्ठ है।'],
['staleSabzi','fermented',0,'both','bowlDal','Yesterday’s sabzi','कल की सब्ज़ी','Stored beyond the day it was cooked.','जिस दिन पकी उससे आगे संचित की गई।'],
['oldPickled','fermented',0,'adults','mushroomCap','Long-stored pickle','पुराना आचार','Preserved for months, and full of active cultures.','महीनों तक संरक्षित, और सक्रिय संवर्धनों से भरा।'],
['alcohol','prohibited',0,'both','milkJug','Alcohol','मदिरा','Brewed by fermentation and it clouds the mind.','किण्वन से बनती है और मन को धुंधला करती है।'],
['beer','prohibited',0,'both','milkJug','Beer','बीयर','A fermented drink that dulls careful attention.','किण्वित पेय, जो सतर्क मन को कुंद करता है।'],
['wine','prohibited',0,'both','milkJug','Wine','वाइन','Made by fermenting fruit, and intoxicating.','फल को किण्वित कर बनाई जाती है, और नशे में डालती है।'],
['nightCooked','prohibited',0,'both','mushroomCap','Food cooked after sunset','सूर्यास्त के बाद बना भोजन','Jain kitchens close before dark, when tiny lives gather.','जैन रसोई अँधेरे से पूर्व बंद हो जाती है, जब सूक्ष्म जीव एकत्र होते हैं।'],
['unfilteredWater','prohibited',0,'both','milkJug','Unfiltered water','अछना जल','Water not boiled and strained may hold unseen life.','बिना उबाले और छने जल में अदृश्य जीवन हो सकता है।'],
['silverLeaf','prohibited',0,'adults','nutShell','Silver leaf','वर्क','Beaten from metal and often handled unhygienically; many families refuse it.','धातु को कूटकर बनाया जाता है और प्रायः अस्वच्छ हाथों से छुआ जाता है; अनेक परिवार इसे अस्वीकार करते हैं।'],
['vinegar','prohibited',0,'adults','milkJug','Vinegar','सिरका','Produced by fermentation, so it is set aside.','किण्वन से बनता है, अतः अलग रखा जाता है।'],
['yeastExtract','prohibited',0,'adults','bowlDal','Yeast extract','यीस्ट सत्व','A concentrated culture of living organisms.','जीवित सूक्ष्मजीवों का सघन संवर्धन।'],
['jellySweets','prohibited',0,'adults','fruitRound','Gelatin sweets','जिलेबी मिठाई','Set with gelatin drawn from animal parts.','पशु अंगों से प्राप्त जेलाटिन से जमाई जाती है।']
];
