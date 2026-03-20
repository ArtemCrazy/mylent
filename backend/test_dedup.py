import sys
from sentence_transformers import SentenceTransformer

def compute_similarity(vec1, vec2):
    dot = sum(a * b for a, b in zip(vec1, vec2))
    norm1 = sum(a * a for a in vec1) ** 0.5
    norm2 = sum(b * b for b in vec2) ** 0.5
    return dot / (norm1 * norm2) if norm1 and norm2 else 0.0

text1 = "😲 «Отключили интернет, блогов нет, каналов нет» — на «Первом канале» ансамбль спел песню о плюсах отключения интернета."
text2 = """На «Поле чудес» спели о том, как хорошо жить без интернета

Как обратила внимание «Верстка», на капитал-шоу «Поле чудес» 20 марта выступила руководитель вокальной студии «Комильфо» из Волгограда Анастасия Серебрякова вместе с детьми. Они исполнили песню об отключении интернета.

Дети спели о том, что из-за отключения интернета «блогов нет, каналов нет», поэтому они играют в бадминтон: «Что за жуткий сон?» Руководительница коллектива в ответ предложила раздать всем Wi-Fi, потому что «хватит бегать во дворе».

В припеве песни есть такие строки:

Не хотим, не хотим —
Не поймаешь в сети.
Не сидим, не сидим в вашем интернете. 
Не хотим, не хотим,
Не сидим, не сидим.
Объявляем год — всё наоборот."""
text3 = "В эфире федерального канала спели песню о пользе отключенного в России интернета: https://t.me/AteoGo/33894"

print("Loading model...")
model = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')
v1 = model.encode(text1).tolist()
v2 = model.encode(text2).tolist()
v3 = model.encode(text3).tolist()

print(f"Similarity Text1 vs Text2: {compute_similarity(v1, v2):.4f}")
print(f"Similarity Text1 vs Text3: {compute_similarity(v1, v3):.4f}")
print(f"Similarity Text2 vs Text3: {compute_similarity(v2, v3):.4f}")
