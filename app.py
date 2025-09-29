from flask import Flask, jsonify, request
import mysql.connector
from mysql.connector import Error
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

db_config = {
    'host': 'localhost',
    'user': 'root',
    'password': '',
    'database': 'clima',
    'port': 3306 
}

def create_connection():
    connection = None
    try:
        connection = mysql.connector.connect(**db_config)
    except Error as e:
        print(f"Error '{e}' al conectar a MySQL")
    return connection

# --- RUTAS DE LA API (AHORA TODAS JUNTAS) ---

@app.route('/api/alerts', methods=['GET'])
def get_alerts():
    conn = create_connection()
    if conn is None: return jsonify({"error": "DB connection failed"}), 500
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM alerts WHERE status = 'active' ORDER BY timestamp DESC")
    alerts = cursor.fetchall()
    cursor.close()
    conn.close()
    return jsonify(alerts)

@app.route('/api/resolve-alert/<int:alert_id>', methods=['POST'])
def resolve_alert(alert_id):
    conn = create_connection()
    if conn is None: return jsonify({"error": "DB connection failed"}), 500
    cursor = conn.cursor()
    query = "UPDATE alerts SET status = 'resolved' WHERE id = %s"
    try:
        cursor.execute(query, (alert_id,))
        conn.commit()
        print(f"Alerta ID {alert_id} marcada como resuelta.")
    except Error as e:
        print(f"Error al actualizar la alerta: {e}")
    finally:
        cursor.close()
        conn.close()
    return jsonify({"success": True}), 200

@app.route('/api/create-alert', methods=['POST'])
def create_alert():
    data = request.get_json()
    if not data: return jsonify({"error": "No data provided"}), 400
    
    query = "INSERT INTO alerts (alert_type, description, latitude, longitude, status) VALUES (%s, %s, %s, %s, %s)"
    
    # Se asume que los datos están presentes debido a la lógica del frontend.
    values = (
        data.get('alertType'), 
        data.get('description'), 
        data.get('coords')['lat'], 
        data.get('coords')['lng'], 
        'active'
    )
    
    conn = create_connection()
    if conn is None: return jsonify({"error": "DB connection failed"}), 500 # Maneja el fallo de conexión
    
    cursor = conn.cursor()
    try:
        cursor.execute(query, values)
        conn.commit()
        print("Nueva alerta creada como 'active'.")
        # RETURN DE ÉXITO: Solo se ejecuta si el commit fue exitoso.
        return jsonify({"success": "Alerta creada exitosamente"}), 201
    except Error as e:
        # RETURN DE ERROR: Se ejecuta si la inserción falla.
        print(f"Error al insertar nueva alerta: {e}")
        return jsonify({"error": f"Database insertion failed: {e}"}), 500
    finally:
        cursor.close()
        # La conexión se cierra en ambos casos (éxito o fallo).
        conn.close()

# --- FUNCIÓN MOVIDA AL LUGAR CORRECTO ---
@app.route('/api/latest-data', methods=['GET'])
def get_latest_data():
    conn = create_connection()
    if conn is None: return jsonify(None), 500
    
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM bme280_data ORDER BY time DESC LIMIT 1")
    latest_data = cursor.fetchone()
    
    cursor.close()
    conn.close()
    
    return jsonify(latest_data)

# --- INICIAR EL SERVIDOR (SIEMPRE AL FINAL) ---
if __name__ == '__main__':
    app.run(debug=True, port=5000)