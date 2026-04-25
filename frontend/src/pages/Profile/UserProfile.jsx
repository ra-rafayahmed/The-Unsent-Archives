import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Masonry from "react-masonry-css";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import NoteCard from "../../components/cards/NoteCard";

const UserProfile = ({ own = false }) => {
  const { id } = useParams();
  const { user } = useAuth();
  const userId = own ? user?.id : id;

  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    const load = async () => {
      if (!userId) return;

      const [pRes, postRes] = await Promise.all([
        api.get(`/users/${userId}`),
        api.get(`/users/${userId}/posts`),
      ]);

      setProfile(pRes.data.user);
      setPosts(postRes.data.posts || []);
    };

    load();
  }, [userId]);

  if (!profile) return <div className="panel">Loading profile...</div>;

  return (
    <section className="profile-layout">
      <div>
        <div className="panel profile-head">
          <h1>{profile.profile?.displayName || profile.username}</h1>
          <p>@{profile.username}</p>
          <p>{profile.bio || "No bio yet."}</p>
          <div className="chip-row">
            <span className="chip">Followers: {profile.followerCount || 0}</span>
            <span className="chip">Following: {profile.followingCount || 0}</span>
          </div>
        </div>

        <Masonry breakpointCols={{ default: 3, 900: 2, 600: 1 }} className="masonry-grid" columnClassName="masonry-col">
          {posts.map((p) => (
            <NoteCard key={p._id} post={p} />
          ))}
        </Masonry>
      </div>

      <aside className="side-stack">
        <div className="panel">
          <h3>Core themes</h3>
          <div className="chip-row">
            {(profile.tagInterests || []).map((tag) => (
              <span key={tag._id} className="chip">#{tag.slug}</span>
            ))}
          </div>
        </div>
      </aside>
    </section>
  );
};

export default UserProfile;
