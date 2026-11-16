import type { AppData } from "./types";
import { addD } from "./time";
import { newEvent, newGoal, newHabit, newList, newSub, newTask, uid } from "./factory";

type Content = Omit<AppData, "settings">;
const r = (m: number) => [{ id: uid(), minutes: m }];

export function makeDemo(t: string): Content {
  const lists = [
    newList({ name: "Личное", color: "#0A84FF", icon: "🏠", position: 0 }),
    newList({ name: "Работа", color: "#FF9F0A", icon: "💼", position: 1 }),
    newList({ name: "Покупки", color: "#30D158", icon: "🛒", position: 2 }),
  ];
  const goal = newGoal({ title: "Английский до уровня B2", icon: "🇬🇧", color: "#BF5AF2", target: addD(t, 60), notes: "Занимаюсь каждый день по 30 минут" });
  const subs = [
    newSub({ goalId: goal.id, title: "Грамматика", position: 0 }),
    newSub({ goalId: goal.id, title: "Словарный запас", position: 1 }),
    newSub({ goalId: goal.id, title: "Аудирование", position: 2 }),
  ];
  const now = Date.now();
  const tasks = [
    newTask({ title: "Купить продукты на неделю", listId: lists[2].id, due: t, checklist: [
      { id: uid(), title: "Овощи и фрукты", done: true }, { id: uid(), title: "Молоко", done: false }, { id: uid(), title: "Хлеб", done: false } ] }),
    newTask({ title: "Позвонить маме", listId: lists[0].id, due: t, time: "18:30", prio: 1, reminders: r(15) }),
    newTask({ title: "Отправить отчёт по проекту", listId: lists[1].id, due: addD(t, 1), time: "12:00", prio: 3, reminders: [{ id: uid(), minutes: 60 }, { id: uid(), minutes: 1440 }] }),
    newTask({ title: "Записаться к стоматологу", listId: lists[0].id, due: addD(t, 3), prio: 1 }),
    newTask({ title: "Оплатить интернет", listId: lists[0].id, due: addD(t, -1), prio: 2 }),
    newTask({ title: "Полить цветы", listId: lists[0].id, due: t, repeat: "weekly" }),
    newTask({ title: "Пройти модуль «Past Perfect»", goalId: goal.id, subId: subs[0].id, due: t, done: true, doneAt: now - 3600e3 }),
    newTask({ title: "Выучить 20 новых слов", goalId: goal.id, subId: subs[1].id, due: t, time: "20:00", prio: 2, reminders: r(30) }),
    newTask({ title: "Послушать подкаст 20 минут", goalId: goal.id, subId: subs[2].id, due: t }),
    newTask({ title: "Сделать тест по грамматике", goalId: goal.id, subId: subs[0].id, due: addD(t, 1) }),
    newTask({ title: "Разобрать почту", listId: lists[1].id, due: addD(t, -2), done: true, doneAt: now - 2 * 864e5 }),
    newTask({ title: "Забронировать отпуск", listId: lists[0].id }),
  ];
  const events = [
    newEvent({ title: "Встреча с командой", date: t, start: "15:00", end: "16:00", color: "#0A84FF", location: "Zoom", notes: "Синхронизация по спринту", reminders: r(15) }),
    newEvent({ title: "Обед с Аней", date: t, start: "13:00", end: "14:00", color: "#FF9F0A", location: "Кафе «Север»", reminders: r(30) }),
    newEvent({ title: "Тренировка", date: addD(t, 1), start: "10:00", end: "11:00", color: "#FF375F", repeat: "weekly", reminders: r(60) }),
    newEvent({ title: "Планирование недели", date: addD(t, 2), start: "09:30", end: "10:30", color: "#BF5AF2", repeat: "weekly" }),
    newEvent({ title: "День рождения Макса", date: addD(t, 5), allDay: true, color: "#30D158", repeat: "yearly", reminders: [{ id: uid(), minutes: 1440 }] }),
    newEvent({ title: "Конференция", date: addD(t, 8), endDate: addD(t, 10), allDay: true, color: "#64D2FF" }),
  ];
  const habits = [
    newHabit({ title: "Чтение 30 минут", icon: "📚", color: "#64D2FF", times: ["21:30"], checks: [t, addD(t, -1), addD(t, -2), addD(t, -4)] }),
    newHabit({ title: "Вода — 2 литра", icon: "💧", color: "#30D158", checks: [addD(t, -1), addD(t, -2), addD(t, -3)] }),
    newHabit({ title: "Тренировка", icon: "🏋️", color: "#FF375F", days: [0, 2, 4], times: ["08:00"], goalId: null, checks: [addD(t, -2), addD(t, -4)] }),
    newHabit({ title: "Повторить слова", icon: "🗣️", color: "#BF5AF2", goalId: goal.id, checks: [addD(t, -1), addD(t, -2)] }),
  ];
  return { lists, goals: [goal], subs, tasks, events, habits };
}
