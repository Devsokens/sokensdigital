import django_cryptography.fields
from django.db import migrations, models


class Migration(migrations.Migration):
    """
    Chiffre au repos ClientDocument.name et EmployeeDocument.document_name
    (AES via django-cryptography, même mécanisme que core.User.email/phone).

    NOTE DÉPLOIEMENT : ceci change uniquement le TYPE de colonne côté
    Django (toujours un varchar en base — django-cryptography stocke le
    ciphertext base64 dans la même colonne CharField). Si des lignes
    existent déjà en base au moment de ce déploiement (nom en clair),
    elles resteront en clair et deviendront ILLISIBLES après cette
    migration (Django tentera de les déchiffrer et échouera) — une
    migration de données (lire en clair AVANT, ré-écrire via le nouveau
    champ chiffré APRÈS) est nécessaire dans ce cas. Sur une base neuve
    (pas encore de données réelles), cette migration seule suffit.
    """

    dependencies = [
        ('administration', '0003_add_contact'),
    ]

    operations = [
        migrations.AlterField(
            model_name='clientdocument',
            name='name',
            field=django_cryptography.fields.encrypt(models.CharField(max_length=255)),
        ),
        migrations.AlterField(
            model_name='employeedocument',
            name='document_name',
            field=django_cryptography.fields.encrypt(models.CharField(max_length=255)),
        ),
    ]
