import mysql.connector
from mysql.connector import Error

print("--- INICIANDO PRUEBA DE CONEXIÓN ---")

db_config = {
    'host': 'localhost',
    'user': 'root',
    'password': '',
    'database': 'clima',
    'port': 3306
}

try:
    connection = mysql.connector.connect(**db_config)

    if connection.is_connected():
        print("\n¡¡¡ÉXITO!!! LA CONEXIÓN A LA BASE DE DATOS 'clima' FUNCIONA PERFECTAMENTE.")
        print("El problema no está en la conexión, sino en cómo se está ejecutando Flask.\n")
        connection.close()

except Error as e:
    print("\n--- FALLÓ LA CONEXIÓN ---")
    print(f"El error es: {e}")
    print("\nEsto confirma que el problema está en la configuración de tu servidor MySQL.")
    print("Python no puede encontrar la base de datos 'clima' en el servidor al que se está conectando.\n")

print("--- FIN DE LA PRUEBA ---")