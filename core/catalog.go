package core

import (
	"slices"
	"strings"
)

// Muscles, her kas grubunun hedef kaslarıdır. Hazır programlar hareketleri bu hedef
// kaslara göre seçer. Arayüz de aynı listeyi kullanır.
var Muscles = map[string][]string{
	"Göğüs":   {"Göğüs", "Üst göğüs", "Alt göğüs"},
	"Sırt":    {"Kanat", "Orta sırt", "Trapez", "Bel"},
	"Bacak":   {"Ön bacak", "Arka bacak", "Kalça", "Baldır", "İç bacak"},
	"Omuz":    {"Ön omuz", "Yan omuz", "Arka omuz"},
	"Kol":     {"Biceps", "Triceps", "Ön kol"},
	"Karın":   {"Karın", "Alt karın", "Yan karın", "Core"},
	"Kardiyo": {},
	"Diğer":   {},
}

type catalogExercise struct {
	name, group, muscle, kind string
	compound                  bool // çok eklemli temel hareket (programda önce gelir)
}

// catalog, hazır hareket listesidir. Her hedef kasta en yaygın hareketler önce gelir:
// hiç puan verilmemişse hazır programlar bu sıraya göre seçer.
var catalog = []catalogExercise{
	// Göğüs
	{"Bench Press", "Göğüs", "Göğüs", KindWeight, true},
	{"Dumbbell Press", "Göğüs", "Göğüs", KindWeight, true},
	{"Chest Press (Makine)", "Göğüs", "Göğüs", KindWeight, true},
	{"Smith Machine Bench Press", "Göğüs", "Göğüs", KindWeight, true},
	{"Şınav", "Göğüs", "Göğüs", KindWeight, true},
	{"Incline Bench Press", "Göğüs", "Üst göğüs", KindWeight, true},
	{"Incline Dumbbell Press", "Göğüs", "Üst göğüs", KindWeight, true},
	{"Smith Machine Incline Press", "Göğüs", "Üst göğüs", KindWeight, true},
	{"Decline Bench Press", "Göğüs", "Alt göğüs", KindWeight, true},
	{"Dips", "Göğüs", "Alt göğüs", KindWeight, true},
	{"Pec Deck", "Göğüs", "Göğüs", KindWeight, false},
	{"Cable Crossover", "Göğüs", "Göğüs", KindWeight, false},
	{"Dumbbell Fly", "Göğüs", "Göğüs", KindWeight, false},
	{"Incline Dumbbell Fly", "Göğüs", "Üst göğüs", KindWeight, false},
	{"Low-to-High Cable Fly", "Göğüs", "Üst göğüs", KindWeight, false},
	{"High-to-Low Cable Fly", "Göğüs", "Alt göğüs", KindWeight, false},
	{"Dumbbell Pullover", "Göğüs", "Göğüs", KindWeight, false},

	// Sırt
	{"Lat Pulldown", "Sırt", "Kanat", KindWeight, true},
	{"Barfiks", "Sırt", "Kanat", KindWeight, true},
	{"Chin-up", "Sırt", "Kanat", KindWeight, true},
	{"Close-Grip Lat Pulldown", "Sırt", "Kanat", KindWeight, true},
	{"Assisted Pull-up (Makine)", "Sırt", "Kanat", KindWeight, true},
	{"Straight-Arm Pulldown", "Sırt", "Kanat", KindWeight, false},
	{"Seated Cable Row", "Sırt", "Orta sırt", KindWeight, true},
	{"Barbell Row", "Sırt", "Orta sırt", KindWeight, true},
	{"Dumbbell Row", "Sırt", "Orta sırt", KindWeight, true},
	{"T-Bar Row", "Sırt", "Orta sırt", KindWeight, true},
	{"Machine Row", "Sırt", "Orta sırt", KindWeight, true},
	{"Chest-Supported Row", "Sırt", "Orta sırt", KindWeight, true},
	{"Deadlift", "Sırt", "Bel", KindWeight, true},
	{"Rack Pull", "Sırt", "Bel", KindWeight, true},
	{"Back Extension", "Sırt", "Bel", KindWeight, false},
	{"Good Morning", "Sırt", "Bel", KindWeight, true},
	{"Dumbbell Shrug", "Sırt", "Trapez", KindWeight, false},
	{"Barbell Shrug", "Sırt", "Trapez", KindWeight, false},

	// Bacak
	{"Squat", "Bacak", "Ön bacak", KindWeight, true},
	{"Leg Press", "Bacak", "Ön bacak", KindWeight, true},
	{"Hack Squat", "Bacak", "Ön bacak", KindWeight, true},
	{"Bulgarian Split Squat", "Bacak", "Ön bacak", KindWeight, true},
	{"Walking Lunge", "Bacak", "Ön bacak", KindWeight, true},
	{"Front Squat", "Bacak", "Ön bacak", KindWeight, true},
	{"Goblet Squat", "Bacak", "Ön bacak", KindWeight, true},
	{"Smith Machine Squat", "Bacak", "Ön bacak", KindWeight, true},
	{"Leg Extension", "Bacak", "Ön bacak", KindWeight, false},
	{"Romanian Deadlift", "Bacak", "Arka bacak", KindWeight, true},
	{"Stiff-Leg Deadlift", "Bacak", "Arka bacak", KindWeight, true},
	{"Leg Curl", "Bacak", "Arka bacak", KindWeight, false},
	{"Seated Leg Curl", "Bacak", "Arka bacak", KindWeight, false},
	{"Nordic Curl", "Bacak", "Arka bacak", KindWeight, false},
	{"Hip Thrust", "Bacak", "Kalça", KindWeight, true},
	{"Sumo Deadlift", "Bacak", "Kalça", KindWeight, true},
	{"Kettlebell Swing", "Bacak", "Kalça", KindWeight, true},
	{"Glute Bridge", "Bacak", "Kalça", KindWeight, false},
	{"Cable Kickback", "Bacak", "Kalça", KindWeight, false},
	{"Hip Abduction (Makine)", "Bacak", "Kalça", KindWeight, false},
	{"Hip Adduction (Makine)", "Bacak", "İç bacak", KindWeight, false},
	{"Calf Raise", "Bacak", "Baldır", KindWeight, false},
	{"Seated Calf Raise", "Bacak", "Baldır", KindWeight, false},
	{"Leg Press Calf Raise", "Bacak", "Baldır", KindWeight, false},

	// Omuz
	{"Shoulder Press", "Omuz", "Ön omuz", KindWeight, true},
	{"Overhead Press", "Omuz", "Ön omuz", KindWeight, true},
	{"Dumbbell Shoulder Press", "Omuz", "Ön omuz", KindWeight, true},
	{"Arnold Press", "Omuz", "Ön omuz", KindWeight, true},
	{"Front Raise", "Omuz", "Ön omuz", KindWeight, false},
	{"Lateral Raise", "Omuz", "Yan omuz", KindWeight, false},
	{"Cable Lateral Raise", "Omuz", "Yan omuz", KindWeight, false},
	{"Machine Lateral Raise", "Omuz", "Yan omuz", KindWeight, false},
	{"Upright Row", "Omuz", "Yan omuz", KindWeight, true},
	{"Face Pull", "Omuz", "Arka omuz", KindWeight, false},
	{"Reverse Pec Deck", "Omuz", "Arka omuz", KindWeight, false},
	{"Rear Delt Fly", "Omuz", "Arka omuz", KindWeight, false},

	// Kol
	{"Biceps Curl", "Kol", "Biceps", KindWeight, false},
	{"Barbell Curl", "Kol", "Biceps", KindWeight, false},
	{"Hammer Curl", "Kol", "Biceps", KindWeight, false},
	{"EZ Bar Curl", "Kol", "Biceps", KindWeight, false},
	{"Preacher Curl", "Kol", "Biceps", KindWeight, false},
	{"Incline Dumbbell Curl", "Kol", "Biceps", KindWeight, false},
	{"Cable Curl", "Kol", "Biceps", KindWeight, false},
	{"Concentration Curl", "Kol", "Biceps", KindWeight, false},
	{"Triceps Pushdown", "Kol", "Triceps", KindWeight, false},
	{"Rope Pushdown", "Kol", "Triceps", KindWeight, false},
	{"Overhead Triceps Extension", "Kol", "Triceps", KindWeight, false},
	{"Skull Crusher", "Kol", "Triceps", KindWeight, false},
	{"Close-Grip Bench Press", "Kol", "Triceps", KindWeight, true},
	{"Bench Dips", "Kol", "Triceps", KindWeight, true},
	{"Triceps Kickback", "Kol", "Triceps", KindWeight, false},
	{"Wrist Curl", "Kol", "Ön kol", KindWeight, false},
	{"Reverse Curl", "Kol", "Ön kol", KindWeight, false},

	// Karın
	{"Crunch", "Karın", "Karın", KindWeight, false},
	{"Cable Crunch", "Karın", "Karın", KindWeight, false},
	{"Machine Crunch", "Karın", "Karın", KindWeight, false},
	{"Leg Raise", "Karın", "Alt karın", KindWeight, false},
	{"Hanging Leg Raise", "Karın", "Alt karın", KindWeight, false},
	{"Reverse Crunch", "Karın", "Alt karın", KindWeight, false},
	{"Russian Twist", "Karın", "Yan karın", KindWeight, false},
	{"Cable Woodchopper", "Karın", "Yan karın", KindWeight, false},
	{"Ab Wheel", "Karın", "Core", KindWeight, false},
	{"Pallof Press", "Karın", "Core", KindWeight, false},
	{"Plank", "Karın", "Core", KindCardio, false},

	// Kardiyo
	{"Koşu Bandı", "Kardiyo", "", KindCardio, false},
	{"Eğimli Yürüyüş", "Kardiyo", "", KindCardio, false},
	{"Bisiklet", "Kardiyo", "", KindCardio, false},
	{"Eliptik", "Kardiyo", "", KindCardio, false},
	{"Kürek Makinesi", "Kardiyo", "", KindCardio, false},
	{"Merdiven Makinesi", "Kardiyo", "", KindCardio, false},
	{"İp Atlama", "Kardiyo", "", KindCardio, false},
}

// addCatalog, hazır listede olup verilerde olmayan hareketleri ekler. Aynı adda (büyük/küçük
// harf farkı gözetmeden) bir hareket zaten varsa yenisi eklenmez; hedef kası boşsa ve
// grubu uyuyorsa doldurulur. Kullanıcının hareketleri, puanları ve geçmişi değişmez.
func addCatalog(d *Data) {
	byName := map[string]int{}
	for i, e := range d.Exercises {
		byName[strings.ToLower(strings.TrimSpace(e.Name))] = i
	}
	for _, c := range catalog {
		if i, ok := byName[strings.ToLower(c.name)]; ok {
			e := &d.Exercises[i]
			if e.Group == c.group {
				if e.Muscle == "" {
					e.Muscle = c.muscle
				}
				if e.Muscle == c.muscle {
					e.Compound = c.compound
				}
			}
			continue
		}
		d.Exercises = append(d.Exercises, Exercise{
			ID: newID(), Name: c.name, Group: c.group, Muscle: c.muscle, Kind: c.kind, Compound: c.compound,
		})
		byName[strings.ToLower(c.name)] = len(d.Exercises) - 1
	}
}

// --- Hazır programlar ---

// slot, programdaki bir hareket yeridir: bu hedef kaslardan biri çalıştırılır.
type slot struct {
	muscles  []string
	compound bool // temel (çok eklemli) hareket tercih edilir
}

var (
	chest     = []string{"Göğüs", "Üst göğüs", "Alt göğüs"}
	upperBack = []string{"Kanat", "Orta sırt"}
	abs       = []string{"Karın", "Alt karın", "Yan karın", "Core"}
)

type builtinProgram struct {
	key, name string
	slots     []slot
}

// builtinPrograms, uygulamanın kendi oluşturduğu programlardır. Hareketleri kullanıcının
// puanlarına göre otomatik seçilir; elle değiştirilemez, kopyası (fork) oluşturulup o
// değiştirilir.
var builtinPrograms = []builtinProgram{
	{"push", "Push", []slot{
		{[]string{"Göğüs", "Alt göğüs"}, true}, {[]string{"Üst göğüs"}, true}, {[]string{"Ön omuz"}, true},
		{[]string{"Yan omuz"}, false}, {chest, false}, {[]string{"Triceps"}, false}, {[]string{"Triceps"}, false},
	}},
	{"pull", "Pull", []slot{
		{[]string{"Kanat"}, true}, {[]string{"Orta sırt"}, true}, {upperBack, true},
		{[]string{"Arka omuz"}, false}, {[]string{"Biceps"}, false}, {[]string{"Biceps"}, false},
	}},
	{"legs", "Legs", []slot{
		{[]string{"Ön bacak"}, true}, {[]string{"Arka bacak"}, true}, {[]string{"Ön bacak"}, true},
		{[]string{"Arka bacak"}, false}, {[]string{"Ön bacak"}, false}, {[]string{"Kalça"}, true}, {[]string{"Baldır"}, false},
	}},
	{"upper", "Upper", []slot{
		{chest, true}, {upperBack, true}, {[]string{"Ön omuz"}, true}, {upperBack, true},
		{[]string{"Yan omuz"}, false}, {[]string{"Biceps"}, false}, {[]string{"Triceps"}, false},
	}},
	{"lower", "Lower", []slot{
		{[]string{"Ön bacak"}, true}, {[]string{"Arka bacak"}, true}, {[]string{"Kalça"}, true},
		{[]string{"Arka bacak"}, false}, {[]string{"Ön bacak"}, false}, {[]string{"Baldır"}, false}, {abs, false},
	}},
	{"fullbody", "Full Body", []slot{
		{[]string{"Ön bacak"}, true}, {chest, true}, {upperBack, true}, {[]string{"Arka bacak"}, true},
		{[]string{"Ön omuz"}, true}, {[]string{"Biceps"}, false}, {[]string{"Triceps"}, false},
	}},
}

const builtinPrefix = "builtin-"

// generate, her yer için en uygun hareketi seçer. Puan (puansız = 3) en önemlisidir;
// yerin istediği türde (temel/yalıtım) hareket 2,5 puanlık avantaj alır. 1 puan verilen
// hareketler ancak başka seçenek yoksa seçilir. Eşitlikte listede önce gelen kazanır.
func generate(exs []Exercise, slots []slot) []string {
	used := map[string]bool{}
	out := []string{}
	for _, sl := range slots {
		best, bestScore := -1, 0.0
		for i, e := range exs {
			if e.Archived || e.Kind != KindWeight || used[e.ID] || !slices.Contains(sl.muscles, e.Muscle) {
				continue
			}
			rating := float64(e.Rating)
			if e.Rating == 0 {
				rating = 3
			}
			score := rating * 10
			if e.Compound == sl.compound {
				score += 25
			}
			if e.Rating == 1 {
				score -= 100
			}
			if best < 0 || score > bestScore {
				best, bestScore = i, score
			}
		}
		if best >= 0 {
			used[exs[best].ID] = true
			out = append(out, exs[best].ID)
		}
	}
	return out
}

// syncBuiltins, hazır programları listenin başına koyar ve hareketlerini güncel puanlara
// göre yeniden seçer. Silinmiş ya da bozulmuş hazır programlar yeniden oluşur.
func syncBuiltins(d *Data) {
	own := slices.DeleteFunc(slices.Clone(d.Templates), func(t Template) bool {
		return t.Builtin != "" || strings.HasPrefix(t.ID, builtinPrefix)
	})
	list := make([]Template, 0, len(builtinPrograms)+len(own))
	for _, p := range builtinPrograms {
		list = append(list, Template{
			ID: builtinPrefix + p.key, Name: p.name, Builtin: p.key, ExerciseIDs: generate(d.Exercises, p.slots),
		})
	}
	d.Templates = append(list, own...)
}
