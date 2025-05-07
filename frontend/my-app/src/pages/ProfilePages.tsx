import axios from "axios";
import "../styles/ProfilePage.css";
import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";

type Post = {
  Post: {
    id: number;
    title: string;
    content: string;
  };
  votes: number;
};

const ProfilePage = () => {
  const { userId } = useParams();
  const [posts, setPosts] = useState<Post[]>([]);
  const [error, setError] = useState("");
  const token = localStorage.getItem("token");

  useEffect(() => {
    if (userId) {
      axios
        .get<Post[]>(`http://localhost:8000/posts/user/${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        .then((res) => setPosts(res.data))
        .catch(() => setError("Не удалось загрузить посты пользователя."));
    }
  }, [userId]);

  const vote = async (postId: number, dir: 0 | 1) => {
    try {
      await axios.post(
        "http://localhost:8000/votes/",
        { post_id: postId, dir },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setPosts((prev) =>
        prev.map((p) =>
          p.Post.id === postId
            ? { ...p, votes: p.votes + (dir === 1 ? 1 : -1) }
            : p
        )
      );
    } catch (err: any) {
      if (err.response?.status === 409) {
        alert("Вы уже проголосовали.");
      } else if (err.response?.status === 404) {
        alert("Голос не найден или пост не существует.");
      } else {
        alert("Ошибка при голосовании.");
      }
    }
  };

  return (
    <div className="profile-container">
      <h2 className="profile-header">Профиль пользователя {userId}</h2>
      {error && <p>{error}</p>}
      {posts.length > 0 ? (
        posts.map((entry) => (
          <div key={entry.Post.id} className="post-card">
            <div className="post-title">{entry.Post.title}</div>
            <div className="post-content">{entry.Post.content}</div>
            <div className="post-votes">Голосов: {entry.votes}</div>
            <div className="vote-buttons">
              <button
                className="vote-button"
                onClick={() => vote(entry.Post.id, 1)}
              >
                👍 Проголосовать
              </button>
              <button
                className="unvote-button"
                onClick={() => vote(entry.Post.id, 0)}
              >
                👎 Удалить голос
              </button>
            </div>
          </div>
        ))
      ) : (
        <p>У пользователя нет постов.</p>
      )}
    </div>
  );
};

export default ProfilePage;
