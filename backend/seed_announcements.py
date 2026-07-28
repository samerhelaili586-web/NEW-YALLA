from app import create_app, db
from app.models.announcement import Announcement, AnnouncementRead
from app.models.user import User

app = create_app()
with app.app_context():
    admin = User.query.filter_by(role='admin_sys').first()
    manager = User.query.filter_by(role='manager').first()

    if admin and not Announcement.query.filter_by(title="🚨 Rappel Important : Temps de travail et Délai J+1").first():
        a1 = Announcement(
            title="🚨 Rappel Important : Temps de travail et Délai J+1",
            content="L'administration rappelle à l'ensemble des collaborateurs (CM, Prod, Chef Prod) que la déclaration quotidienne des heures de travail est obligatoire. Si vous avez oublié de déclarer votre temps hier, vous avez jusqu'à ce soir 23h59 (délai de grâce J+1) pour vous régulariser.",
            priority="urgent",
            author_id=admin.id
        )
        db.session.add(a1)
        db.session.flush()
        db.session.add(AnnouncementRead(announcement_id=a1.id, user_id=admin.id))

    if manager and not Announcement.query.filter_by(title="📢 Lancement du nouveau module Communiqués Internes").first():
        a2 = Announcement(
            title="📢 Lancement du nouveau module Communiqués Internes",
            content="Nous avons le plaisir de vous annoncer la mise en place de la section Communiqués dans l'espace Général. Les annonces officielles, consignes et événements d'entreprise y seront régulièrement publiés.",
            priority="info",
            author_id=manager.id
        )
        db.session.add(a2)
        db.session.flush()
        db.session.add(AnnouncementRead(announcement_id=a2.id, user_id=manager.id))

    db.session.commit()
    print("Sample announcements seeded successfully!")
