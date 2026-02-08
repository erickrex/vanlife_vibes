# Generated manually to add 200 more cities for nomads and van lifers

from django.db import migrations


# 200 additional cities relevant to nomads and van lifers in continental US
# Focused on: major cities, outdoor recreation hubs, national parks, scenic routes,
# popular van life destinations, and tourist attractions
ADDITIONAL_CITIES = [
    # Northeast - Major cities and outdoor destinations
    'New York City, NY', 'Brooklyn, NY', 'Buffalo, NY', 'Ithaca, NY', 'Lake Placid, NY',
    'Adirondacks, NY', 'Finger Lakes, NY', 'Catskills, NY', 'Woodstock, NY', 'Hudson, NY',
    'Boston, MA', 'Cambridge, MA', 'Cape Cod, MA', 'Provincetown, MA', 'Northampton, MA',
    'The Berkshires, MA', 'Salem, MA', 'Martha\'s Vineyard, MA', 'Nantucket, MA',
    'Portland, ME', 'Bangor, ME', 'Camden, ME', 'Kennebunkport, ME',
    'Stowe, VT', 'Montpelier, VT', 'Woodstock, VT', 'Killington, VT', 'Manchester, VT',
    'Portsmouth, NH', 'North Conway, NH', 'White Mountains, NH', 'Franconia, NH', 'Hanover, NH',
    'Providence, RI', 'Newport, RI', 'Block Island, RI',
    'Hartford, CT', 'New Haven, CT', 'Mystic, CT',
    'Philadelphia, PA', 'Pittsburgh, PA', 'Gettysburg, PA', 'Lancaster, PA', 'Poconos, PA',
    'State College, PA', 'Erie, PA',
    'Newark, NJ', 'Jersey Shore, NJ', 'Cape May, NJ', 'Princeton, NJ',
    
    # Mid-Atlantic and Southeast
    'Washington DC, DC', 'Baltimore, MD', 'Annapolis, MD', 'Ocean City, MD',
    'Virginia Beach, VA', 'Richmond, VA', 'Charlottesville, VA', 'Shenandoah, VA',
    'Norfolk, VA', 'Roanoke, VA', 'Williamsburg, VA',
    'Wilmington, NC', 'Charlotte, NC', 'Raleigh, NC', 'Outer Banks, NC', 'Boone, NC',
    'Blowing Rock, NC', 'Bryson City, NC', 'Cherokee, NC',
    'Myrtle Beach, SC', 'Hilton Head, SC', 'Greenville, SC', 'Columbia, SC',
    'Atlanta, GA', 'Athens, GA', 'Tybee Island, GA', 'Jekyll Island, GA', 'Helen, GA',
    'Jacksonville, FL', 'Gainesville, FL', 'Pensacola, FL', 'Panama City Beach, FL',
    'Fort Lauderdale, FL', 'Naples, FL', 'Clearwater, FL', 'Sarasota, FL',
    
    # Deep South
    'Birmingham, AL', 'Mobile, AL', 'Gulf Shores, AL', 'Huntsville, AL',
    'Jackson, MS', 'Natchez, MS', 'Oxford, MS', 'Biloxi, MS',
    'Baton Rouge, LA', 'Lafayette, LA', 'Lake Charles, LA',
    'Little Rock, AR', 'Hot Springs, AR', 'Eureka Springs, AR', 'Fayetteville, AR', 'Bentonville, AR',
    
    # Tennessee and Kentucky
    'Memphis, TN', 'Knoxville, TN', 'Chattanooga, TN', 'Gatlinburg, TN', 'Pigeon Forge, TN',
    'Great Smoky Mountains, TN', 'Johnson City, TN',
    'Louisville, KY', 'Lexington, KY', 'Bowling Green, KY', 'Mammoth Cave, KY', 'Bardstown, KY',
    
    # Midwest
    'Chicago, IL', 'Springfield, IL', 'Galena, IL', 'Champaign, IL',
    'Indianapolis, IN', 'Bloomington, IN', 'South Bend, IN', 'Brown County, IN',
    'Detroit, MI', 'Ann Arbor, MI', 'Traverse City, MI', 'Mackinac Island, MI',
    'Grand Rapids, MI', 'Sleeping Bear Dunes, MI', 'Marquette, MI', 'Pictured Rocks, MI',
    'Cleveland, OH', 'Columbus, OH', 'Cincinnati, OH', 'Hocking Hills, OH', 'Put-in-Bay, OH',
    'Milwaukee, WI', 'Madison, WI', 'Door County, WI', 'Wisconsin Dells, WI', 'Apostle Islands, WI',
    'Minneapolis, MN', 'St. Paul, MN', 'Duluth, MN', 'Boundary Waters, MN', 'Brainerd, MN',
    'Des Moines, IA', 'Iowa City, IA', 'Dubuque, IA',
    'St. Louis, MO', 'Kansas City, MO', 'Branson, MO', 'Springfield, MO', 'Lake of the Ozarks, MO',
    
    # Great Plains
    'Omaha, NE', 'Lincoln, NE', 'Scottsbluff, NE',
    'Wichita, KS', 'Lawrence, KS', 'Dodge City, KS',
    'Oklahoma City, OK', 'Tulsa, OK', 'Norman, OK', 'Turner Falls, OK',
    'Sioux Falls, SD', 'Rapid City, SD', 'Deadwood, SD', 'Badlands, SD', 'Black Hills, SD',
    'Fargo, ND', 'Bismarck, ND', 'Theodore Roosevelt, ND', 'Medora, ND',
    
    # Texas (additional)
    'Houston, TX', 'Dallas, TX', 'Fort Worth, TX', 'Galveston, TX', 'Corpus Christi, TX',
    'Amarillo, TX', 'Lubbock, TX', 'Midland, TX', 'Terlingua, TX', 'Alpine, TX',
    'Port Aransas, TX', 'Padre Island, TX', 'Palo Duro Canyon, TX', 'Guadalupe Mountains, TX',
    
    # Additional Southwest
    'Saguaro, AZ', 'Tombstone, AZ', 'Petrified Forest, AZ', 'Antelope Canyon, AZ', 'Horseshoe Bend, AZ',
    'Mesa Verde, CO', 'Black Canyon, CO', 'Great Sand Dunes, CO', 'Silverton, CO', 'Pagosa Springs, CO',
    'Bandelier, NM', 'Chaco Canyon, NM', 'Ruidoso, NM', 'Silver City, NM', 'Truth or Consequences, NM',
    'Bryce, UT', 'Escalante, UT', 'Torrey, UT', 'Springdale, UT', 'Bluff, UT',
    'Tonopah, NV', 'Ely, NV', 'Virginia City, NV', 'Elko, NV',
    
    # Additional California
    'Sacramento, CA', 'Oakland, CA', 'Berkeley, CA', 'Napa Valley, CA', 'Sonoma, CA',
    'Mendocino, CA', 'Eureka, CA', 'Arcata, CA', 'Shasta, CA', 'Lassen, CA',
    'Fresno, CA', 'Bakersfield, CA', 'Solvang, CA', 'Ojai, CA', 'Cambria, CA',
    'Pismo Beach, CA', 'San Luis Obispo, CA', 'Paso Robles, CA', 'Carmel, CA', 'Half Moon Bay, CA',
    
    # Additional Pacific Northwest
    'Tacoma, WA', 'Olympia, WA', 'Port Angeles, WA', 'Port Townsend, WA', 'San Juan Islands, WA',
    'North Cascades, WA', 'Wenatchee, WA', 'Yakima, WA',
    'Salem, OR', 'Medford, OR', 'Klamath Falls, OR', 'Newport, OR', 'Florence, OR',
    'Bandon, OR', 'Joseph, OR', 'Pendleton, OR',
    
    # Additional Mountain West
    'Billings, MT', 'Great Falls, MT', 'Kalispell, MT', 'Butte, MT', 'Red Lodge, MT',
    'Twin Falls, ID', 'Idaho Falls, ID', 'Sandpoint, ID', 'Stanley, ID', 'Craters of the Moon, ID',
    'Casper, WY', 'Sheridan, WY', 'Thermopolis, WY', 'Devils Tower, WY', 'Pinedale, WY',
]


def add_cities(apps, schema_editor):
    Country = apps.get_model('core', 'Country')
    City = apps.get_model('core', 'City')

    usa = Country.objects.get(code='US')

    added = 0
    for city in ADDITIONAL_CITIES:
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
        ('core', '0031_remove_legacy_group_session_models'),
    ]

    operations = [
        migrations.RunPython(add_cities, migrations.RunPython.noop),
    ]
