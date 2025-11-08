import json
from topojson import Topology
import os

def convert_geojson_to_topojson(geojson_path, topojson_path):
    """
    Конвертирует GeoJSON файл в TopoJSON.

    Args:
        geojson_path (str): Путь к входному GeoJSON файлу.
        topojson_path (str): Путь к выходному TopoJSON файлу.
    """
    if not os.path.exists(geojson_path):
        print(f"Ошибка: Файл GeoJSON не найден по пути: {geojson_path}")
        return

    print(f"Начинается конвертация файла: {geojson_path}")
    try:
        with open(geojson_path, 'r', encoding='utf-8') as f:
            geojson_data = json.load(f)

        # Инициализируем конвертер TopoJSON
        # prequantize - параметр для квантования координат (уменьшает размер файла)
        # topoquantize - дополнительное квантование топологии
        # Используем False если не нужно упрощение, или число (например 1e5) для упрощения
        tj = Topology(geojson_data, prequantize=False)

        # Конвертируем в словарь TopoJSON
        topojson_dict = tj.to_dict()

        # Сохраняем в файл
        with open(topojson_path, 'w', encoding='utf-8') as f:
            json.dump(topojson_dict, f, ensure_ascii=False, indent=2)

        print(f"Успешно сконвертировано {geojson_path} в {topojson_path}")
        print(f"Размер TopoJSON файла: {os.path.getsize(topojson_path) / 1024:.2f} КБ")

    except Exception as e:
        import traceback
        print(f"Произошла ошибка во время конвертации: {e}")
        print("Подробности ошибки:")
        traceback.print_exc()

# --- Пример использования ---
# Укажите путь к вашему GeoJSON файлу
geojson_input_file = \
      "C:\\Users\\Pilot_Gudkov\\KARTA\\visota\\visota.geojson"
# Укажите путь для сохранения TopoJSON файла
topojson_output_file = \
      "C:\\Users\\Pilot_Gudkov\\KARTA\\visota\\visota.topojson"

convert_geojson_to_topojson(geojson_input_file, topojson_output_file)