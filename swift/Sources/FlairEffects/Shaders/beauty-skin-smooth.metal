// flair-metal-hash: 08df9e33
#pragma clang diagnostic ignored "-Wunused-variable"
#pragma clang diagnostic ignored "-Wunused-const-variable"
#pragma clang diagnostic ignored "-Wmissing-prototypes"

#include <metal_stdlib>
#include <simd/simd.h>

using namespace metal;

struct FlairUniforms
{
    packed_float3 iResolution;
    float iTime;
    float iTimeDelta;
    int iFrame;
    float iBeat;
    float flair_flipY;
    float4 iMouse;
    float4 iPointer;
    float4 iClicks[8];
    float4 iTrail[32];
    float4 iAudio;
    float4 iSpectrum[16];
    float4 iScroll;
    float uAmount;
    float uRadius;
    float uEdges;
    float uTexture;
    float uSkinOnly;
    float2 uCentre;
    float2 uSize;
    int uShape;
    float uFeather;
    uint uInvert;
    char _m23_pad[12];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_beauty_skin_smooth_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _68)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_68.uBackdrop) * _68.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_68.uBackdropAlpha * (1.0 - s.w));
    return float4(colour / float3(fast::max(alpha, 9.9999997473787516355514526367188e-05)), alpha);
}

static inline __attribute__((always_inline))
float3 testCard(thread const float2& uv)
{
    float3 sky = mix(float3(0.980000019073486328125, 0.62000000476837158203125, 0.4199999868869781494140625), float3(0.23999999463558197021484375, 0.319999992847442626953125, 0.7200000286102294921875), float3(uv.y));
    float sun = smoothstep(0.1599999964237213134765625, 0.1500000059604644775390625, length((uv - float2(0.64999997615814208984375, 0.579999983310699462890625)) * float2(1.60000002384185791015625, 1.0)));
    float hills = step(uv.y, (0.319999992847442626953125 + (0.0599999986588954925537109375 * sin(uv.x * 9.0))) + (0.039999999105930328369140625 * sin((uv.x * 23.0) + 1.0)));
    float3 col = mix(sky, float3(1.0, 0.920000016689300537109375, 0.699999988079071044921875), float3(sun));
    col = mix(col, float3(0.119999997317790985107421875, 0.2800000011920928955078125, 0.23999999463558197021484375) + float3(0.07999999821186065673828125 * sin(uv.x * 40.0)), float3(hills));
    float2 grid = abs(fract(uv * 8.0) - float2(0.5));
    col += float3(0.039999999105930328369140625 * step(0.4799999892711639404296875, fast::max(grid.x, grid.y)));
    return col;
}

static inline __attribute__((always_inline))
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _68)
{
    float4 _212;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _212 = overBackdrop(param, _68);
    }
    else
    {
        float2 param_1 = fract(uv);
        _212 = float4(testCard(param_1), 1.0);
    }
    return _212;
}

static inline __attribute__((always_inline))
float region(thread const float2& fragCoord, constant FlairUniforms& _68)
{
    float2 hs = fast::max((_68.uSize * 0.5) * float2(_68.iResolution[0], _68.iResolution[1]), float2(1.0));
    float2 p = fragCoord - (_68.uCentre * float2(_68.iResolution[0], _68.iResolution[1]));
    float d;
    if (_68.uShape == 0)
    {
        float2 q = abs(p) - hs;
        d = length(fast::max(q, float2(0.0))) + fast::min(fast::max(q.x, q.y), 0.0);
    }
    else
    {
        d = (length(p / hs) - 1.0) * fast::min(hs.x, hs.y);
    }
    float m = 1.0 - smoothstep(((-0.5) * _68.uFeather) - 0.5, (0.5 * _68.uFeather) + 0.5, d);
    float _368;
    if (_68.uInvert != 0u)
    {
        _368 = 1.0 - m;
    }
    else
    {
        _368 = m;
    }
    return _368;
}

static inline __attribute__((always_inline))
float skinLike(thread const float3& c)
{
    float y = dot(c, float3(0.2989999949932098388671875, 0.58700001239776611328125, 0.114000000059604644775390625));
    float cb = ((0.5 - (0.16869999468326568603515625 * c.x)) - (0.3312999904155731201171875 * c.y)) + (0.5 * c.z);
    float cr = ((0.5 + (0.5 * c.x)) - (0.4187000095844268798828125 * c.y)) - (0.081299997866153717041015625 * c.z);
    return (((smoothstep(0.5299999713897705078125, 0.569999992847442626953125, cr) * smoothstep(0.7200000286102294921875, 0.680000007152557373046875, cr)) * smoothstep(0.2800000011920928955078125, 0.319999992847442626953125, cb)) * smoothstep(0.519999980926513671875, 0.4799999892711639404296875, cb)) * smoothstep(0.0599999986588954925537109375, 0.1599999964237213134765625, y);
}

static inline __attribute__((always_inline))
float3 evenSkin(thread const float2& fragCoord, thread const float3& here, thread const float& radius, thread const float& edges, constant FlairUniforms& _68, texture2d<float> uImage, sampler uImageSmplr)
{
    float3 sum = here;
    float wsum = 1.0;
    for (int i = 0; i < 12; i++)
    {
        float r = radius * ((i < 6) ? 0.5 : 1.0);
        float a = (float(i) * 1.0471999645233154296875) + ((i < 6) ? 0.0 : 0.52359998226165771484375);
        float2 param = (fragCoord + (float2(cos(a), sin(a)) * r)) / float2(_68.iResolution[0], _68.iResolution[1]);
        float3 c = pictureRGBA(uImage, uImageSmplr, param, _68).xyz;
        float3 d = c - here;
        float w = exp((-dot(d, d)) / ((2.0 * edges) * edges));
        sum += (c * w);
        wsum += w;
    }
    return sum / float3(wsum);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _68, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 px = float2(1.0) / float2(_68.iResolution[0], _68.iResolution[1]);
    float2 param = fragCoord * px;
    float4 pic = pictureRGBA(uImage, uImageSmplr, param, _68);
    float2 param_1 = fragCoord;
    float3 param_2 = pic.xyz;
    float m = (region(param_1, _68) * mix(1.0, skinLike(param_2), _68.uSkinOnly)) * _68.uAmount;
    if (m <= 0.0)
    {
        fragColor = pic;
        return;
    }
    float2 param_3 = fragCoord;
    float3 param_4 = pic.xyz;
    float param_5 = _68.uRadius;
    float param_6 = _68.uEdges;
    float3 even = evenSkin(param_3, param_4, param_5, param_6, _68, uImage, uImageSmplr);
    float2 param_7 = (fragCoord + float2(1.5, 0.0)) * px;
    float2 param_8 = (fragCoord - float2(1.5, 0.0)) * px;
    float2 param_9 = (fragCoord + float2(0.0, 1.5)) * px;
    float2 param_10 = (fragCoord - float2(0.0, 1.5)) * px;
    float3 near = (((pictureRGBA(uImage, uImageSmplr, param_7, _68).xyz + pictureRGBA(uImage, uImageSmplr, param_8, _68).xyz) + pictureRGBA(uImage, uImageSmplr, param_9, _68).xyz) + pictureRGBA(uImage, uImageSmplr, param_10, _68).xyz) * 0.25;
    float3 col = fast::clamp(even + ((pic.xyz - near) * _68.uTexture), float3(0.0), float3(1.0));
    fragColor = float4(mix(pic.xyz, col, float3(m)), pic.w);
}

fragment flair_beauty_skin_smooth_frag_out flair_beauty_skin_smooth_frag(constant FlairUniforms& _68 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_beauty_skin_smooth_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _583;
    if (_68.flair_flipY > 0.5)
    {
        _583 = _68.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _583 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _583);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _68, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

