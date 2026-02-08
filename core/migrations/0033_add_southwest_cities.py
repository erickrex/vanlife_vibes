# Generated manually to add 30 more cities around Utah, Nevada, California, and Colorado

from django.db import migrations


SOUTHWEST_CITIES = [
    # Utah - additional smaller towns and recreation areas
    'Vernal, UT', 'Price, UT', 'Richfield, UT', 'Cedar City, UT', 'Logan, UT',
    'Ogden, UT', 'Provo, UT', 'Heber City, UT', 'Green River, UT', 'Mexican Hat, UT',
    
    # Nevada - additional towns
    'Boulder City, NV', 'Mesquite, NV', 'Pahrump, NV', 'Winnemucca, NV', 'Fallon, NV',
    'Carson City, NV', 'Laughlin, NV',
    
    # California - additional outdoor and coastal towns
    'Truckee, CA', 'Lone Pine, CA', 'Bridgeport, CA', 'June Lake, CA', 'Lee Vining, CA',
    'Crescent City, CA', 'Mount Shasta, CA', 'Dunsmuir, CA',
    
    # Colorado - additional mountain towns
    'Leadville, CO', 'Salida, CO', 'Buena Vista, CO', 'Ridgway, CO', 'Lake City, CO',
]


def add_cities(apps, schema_editor):
    Country = apps.get_model('core', 'Country')
    City = apps.get_model('core', 'City')

    usa = Country.objects.get(code='US')

    added = 0
    for city in SOUTHWEST_CITIES:
        if ',' not in city:
            continue
        name, state_code = [part.strip() for part in city.split(',', 1)]
        if not name or not state_code:
            continue
        display_name = f"{name}, {state_code}"
        _, created = City.objects.get_or_create(
            name=name,
            state_code=state_code,
            country=usa,
            defaults={'display_name': display_name}
        )
        if created:
            added += 1
    
    print(f"Added {added} new cities")


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0032_add_more_cities'),
    ]

    operations = [
        migrations.RunPython(add_cities, migrations.RunPython.noop),
    ]
