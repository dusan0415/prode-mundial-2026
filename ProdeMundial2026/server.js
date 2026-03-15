const multer = require("multer")
const XLSX = require("xlsx")

const upload = multer({ dest: "uploads/" })

const express = require("express");
const sqlite3 = require("sqlite3").verbose();

const app = express();
app.use(express.json());
app.use(express.static("public"));

const db = new sqlite3.Database("prode.db");

db.run(`
CREATE TABLE IF NOT EXISTS participantes(
id INTEGER PRIMARY KEY AUTOINCREMENT,
nombre TEXT,
apellido TEXT,
dni TEXT,
telefono TEXT,
puntos INTEGER DEFAULT 0
)
`);

db.run(`
CREATE TABLE IF NOT EXISTS partidos(
id INTEGER PRIMARY KEY AUTOINCREMENT,
fase TEXT,
equipo_local TEXT,
equipo_visitante TEXT,
resultado TEXT
)
`);

db.run(`
CREATE TABLE IF NOT EXISTS pronosticos(
id INTEGER PRIMARY KEY AUTOINCREMENT,
participante_id INTEGER,
partido_id INTEGER,
pronostico TEXT
)
`);



app.get("/", (req, res) => {
    res.send("Servidor del Prode funcionando ⚽");
});

app.get("/participantes", (req, res) => {

    db.all("SELECT * FROM participantes", [], (err, rows) => {
        if (err) {
            res.status(500).send(err);
            return;
        }
        res.json(rows);
    })

});

app.post("/participantes", (req, res) => {

    const { nombre, apellido, dni, telefono } = req.body;

    db.run(
        `INSERT INTO participantes(nombre,apellido,dni,telefono)
VALUES(?,?,?,?)`,
        [nombre, apellido, dni, telefono],
        function (err) {

            if (err) {
                res.status(500).send(err);
                return;
            }

            res.json({ id: this.lastID });

        })

});

app.get("/partidos", (req, res) => {

    db.all("SELECT * FROM partidos", [], (err, rows) => {

        if (err) {
            res.status(500).send(err)
            return
        }

        res.json(rows)

    })

})

app.post("/partidos", (req, res) => {

    const { fase, equipo_local, equipo_visitante } = req.body

    db.run(
        `INSERT INTO partidos(fase,equipo_local,equipo_visitante)
VALUES(?,?,?)`,
        [fase, equipo_local, equipo_visitante],
        function (err) {

            res.json({ id: this.lastID })

        })

})

app.post("/pronostico", (req, res) => {

    const { participante_id, partido_id, pronostico } = req.body

    db.run(
        `INSERT INTO pronosticos(participante_id,partido_id,pronostico)
VALUES(?,?,?)`,
        [participante_id, partido_id, pronostico],
        function (err) {

            res.json({ id: this.lastID })

        })

})

app.post("/resultado", (req, res) => {

    const { partido_id, resultado } = req.body

    db.run(
        `UPDATE partidos SET resultado=? WHERE id=?`,
        [resultado, partido_id],
        function (err) {

            if (err) {
                res.status(500).send(err)
                return
            }

            res.json({ ok: true })

        })

})

app.get("/calcular", (req, res) => {

    db.all(`
SELECT pronosticos.id,
pronosticos.pronostico,
partidos.resultado,
partidos.fase
FROM pronosticos
JOIN partidos ON pronosticos.partido_id = partidos.id
`, [], (err, rows) => {

        rows.forEach(r => {

            let puntos = 0

            if (r.pronostico === r.resultado) {

                switch (r.fase) {

                    case "grupos":
                        puntos = 4
                        break

                    case "16avos":
                        puntos = 4
                        break

                    case "octavos":
                        puntos = 6
                        break

                    case "cuartos":
                        puntos = 8
                        break

                    case "semifinal":
                        puntos = 10
                        break

                    case "tercer":
                        puntos = 15
                        break

                    case "final":
                        puntos = 25
                        break

                }

            }

            db.run(
                "UPDATE pronosticos SET puntos=? WHERE id=?",
                [puntos, r.id]
            )

        })

        res.send("Puntos calculados")

    })

})

app.get("/ranking", (req, res) => {

    db.all(`
SELECT participantes.nombre,
participantes.apellido,
SUM(pronosticos.puntos) as puntos
FROM participantes
LEFT JOIN pronosticos
ON participantes.id = pronosticos.participante_id
GROUP BY participantes.id
ORDER BY puntos DESC
`, [], (err, rows) => {

        res.json(rows)

    })

})

app.get("/fixture", (req, res) => {

    const partidos = [

        ["grupos", "Argentina", "Brasil"],
        ["grupos", "Francia", "Alemania"],
        ["grupos", "España", "Italia"],
        ["grupos", "Uruguay", "Portugal"]

    ]

    partidos.forEach(p => {

        db.run(
            `INSERT INTO partidos(fase,equipo_local,equipo_visitante)
VALUES(?,?,?)`,
            [p[0], p[1], p[2]]
        )

    })

    res.send("Fixture cargado")

})

app.post("/importar-participantes", upload.single("archivo"), (req, res) => {

    if (!req.file) {
        return res.status(400).send("No se envió ningún archivo")
    }

    const workbook = XLSX.readFile(req.file.path)

    const sheet = workbook.Sheets[workbook.SheetNames[0]]

    const datos = XLSX.utils.sheet_to_json(sheet)

    datos.forEach(p => {

        db.run(
            `INSERT INTO participantes(nombre,apellido,dni,telefono)
VALUES(?,?,?,?)`,
            [p.nombre, p.apellido, p.dni, p.telefono]
        )

    })

    res.send("Participantes importados correctamente")

})

app.post("/guardar-pronosticos", (req, res) => {

    const { participante_id, pronosticos } = req.body

    pronosticos.forEach(p => {

        db.run(
            `INSERT INTO pronosticos(participante_id,partido_id,pronostico)
VALUES(?,?,?)`,
            [participante_id, p.partido_id, p.pronostico]
        )

    })

    res.send("Pronósticos guardados")

})

app.get("/generar-grupos", (req, res) => {

    const grupos = {

        A: ["Argentina", "México", "Japón", "Nigeria"],
        B: ["Brasil", "USA", "Corea", "Egipto"],
        C: ["Francia", "Uruguay", "Canadá", "Marruecos"],
        D: ["España", "Croacia", "Australia", "Chile"]

    }

    Object.keys(grupos).forEach(g => {

        let equipos = grupos[g]

        for (let i = 0; i < equipos.length; i++) {

            for (let j = i + 1; j < equipos.length; j++) {

                db.run(
                    `INSERT INTO partidos(fase,equipo_local,equipo_visitante)
VALUES(?,?,?)`,
                    ["grupos", equipos[i], equipos[j]]
                )

            }

        }

    })

    res.send("Partidos de grupos generados")

})

const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
    console.log("Servidor corriendo en puerto " + PORT)
})

