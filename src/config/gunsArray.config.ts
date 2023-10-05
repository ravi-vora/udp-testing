export const GUNS_ARRAY = 
[
    {
        "name" : "pistol_1", // fast fire
        "index" : 0.0,
        "damageRate" : 10,
        "magazine": 3,
        "ammoCount" : 60,
        "fireRate" : 2.0
    },
    {
        "name" : "revolver", // pistol_1 <
        "index" : 1.0,
        "damageRate" : 30,
        "magazine": 6,
        "ammoCount" : 36,
        "fireRate" : 2.0
    },
    {
        "name" : "rifle 1", // > pistol_1
        "index" : 2.0,
        "damageRate" : 7,
        "magazine": 6,
        "ammoCount" : 270,
        "fireRate" : 6.0
    },
    { 
        "name" : "AKM", // < M416
        "index" : 3.0,
        "damageRate" : 10.0,
        "magazine": 5,
        "ammoCount" : 200,
        "fireRate" : 10.0
    },
    {
        "name" : "M416", // > rifle 1, fire -> 3 at one
        "index" : 4.0,
        "damageRate" : 10.0,
        "magazine": 7,
        "ammoCount" : 168,
        "fireRate" : 13.0
    },
    {
        "name" : "shotgun 1", // == revolver
        "index" : 5.0,
        "damageRate" : 100,
        "magazine": 6,
        "ammoCount" : 30,
        "fireRate" : 4.0
    },
    {
        "name" : "shotgun 2", // == sniper 1
        "index" : 6.0,
        "damageRate" : 55,
        "magazine": 6,
        "ammoCount" : 30,
        "fireRate" : 4.0
    },
    {
        "name" : "sniper 1",
        "index" : 7.0,
        "damageRate" : 100.0,
        "magazine": 6,
        "ammoCount" : 42,
        "fireRate" : 2.0
    },
    {
        "name" : "sniper 2", // reload long
        "index" : 8.0,
        "damageRate" : 100.0,
        "magazine": 7,
        "ammoCount" : 28,
        "fireRate" : 3.0
    },
    {
        "name" : "rocket launcher", // reload long
        "index" : 9.0,
        "damageRate" : 5.0,
        "magazine": 2,
        "ammoCount" : 6,
        "fireRate" : 1.0
    }
]

export const gunsFireRate = [
    '10|2',  '30|2',
    '7|6',   '10|10',
    '10|13', '100|4',
    '55|4',  '100|2',
    '100|3', '5|1'
  ]