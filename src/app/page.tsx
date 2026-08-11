import styles from "./page.module.css";

const meals = [
  { name: "아침", type: "클린식", food: "두부 340g, 바나나", image: "/clean.png" },
  { name: "점심", type: "클린식", food: "연어 포케", image: "/clean.png" },
  { name: "저녁", type: "클린식", food: "닭가슴살, 양배추", image: "/clean.png" },
  { name: "간식", type: "자유식", food: "카페라떼", image: "/free.png" },
];

export default function Home() {
  return (
    <main className={styles.main}>
      <section className={styles.header}>
        <p className={styles.eyebrow}>오늘의 기록</p>
        <h1>오늘도 가볍게</h1>
        <p>식단과 체중을 기록해 오늘을 완성하세요.</p>
      </section>
      <section className={styles.mealGrid} aria-label="오늘의 식단">
        {meals.map((meal) => (
          <article className={styles.mealCard} key={meal.name}>
            <div>
              <p className={styles.mealName}>{meal.name}</p>
              <p className={styles.food}>{meal.food}</p>
              <span className={meal.type === "클린식" ? styles.cleanTag : styles.freeTag}>
                {meal.type}
              </span>
            </div>
            <img className={styles.character} src={meal.image} alt={`${meal.type} 캐릭터`} />
          </article>
        ))}
      </section>
    </main>
  );
}
