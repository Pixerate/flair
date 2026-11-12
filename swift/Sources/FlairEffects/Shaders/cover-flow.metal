// flair-metal-hash: 32e77466
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
    int uCards;
    float uStep;
    float uRadius;
    float uReflection;
    float3 uBackground;
    float3 uCardBack;
    packed_float3 uBackdrop;
    float uBackdropAlpha;
    float uBackgroundAlpha;
};

struct flair_cover_flow_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float roundedBox(thread const float2& p, thread const float2& hs, thread const float& r)
{
    float2 e = (abs(p) - hs) + float2(r);
    return (length(fast::max(e, float2(0.0))) + fast::min(fast::max(e.x, e.y), 0.0)) - r;
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _88)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_88.uBackdrop) * _88.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_88.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _88)
{
    float4 _232;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _232 = overBackdrop(param, _88);
    }
    else
    {
        float2 param_1 = fract(uv);
        _232 = float4(testCard(param_1), 1.0);
    }
    return _232;
}

static inline __attribute__((always_inline))
float3 picture(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _88)
{
    float2 param = uv;
    return pictureRGBA(tex, texSmplr, param, _88).xyz;
}

static inline __attribute__((always_inline))
float3 cardFace(thread const float2& cuv, thread const int& i, constant FlairUniforms& _88, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 ts = float2(int2(uImage.get_width(), uImage.get_height()));
    float imageAspect = ts.x / fast::max(ts.y, 1.0);
    float aspect = 0.7333333492279052734375;
    float2 _301;
    if (imageAspect > aspect)
    {
        _301 = float2(aspect / imageAspect, 1.0);
    }
    else
    {
        _301 = float2(1.0, imageAspect / aspect);
    }
    float2 fit = _301;
    float pan = fract(float(i) * 0.617999970912933349609375) - 0.5;
    float2 param = (float2(0.5) + ((cuv - float2(0.5)) * fit)) + float2(pan * (1.0 - fit.x), 0.0);
    float3 c = picture(uImage, uImageSmplr, param, _88);
    float3 tint = float3(0.5) + (cos((float3(float(i) * 0.12999999523162841796875) + float3(0.0, 0.3300000131130218505859375, 0.670000016689300537109375)) * 6.28318023681640625) * 0.5);
    return mix(c, (c * tint) * 1.2999999523162841796875, float3(0.180000007152557373046875));
}

static inline __attribute__((always_inline))
float4 cardsHit(thread const float3& ro, thread const float3& rd, thread const float& turn, thread const int& n, thread float& tHit, constant FlairUniforms& _88, texture2d<float> uImage, sampler uImageSmplr)
{
    tHit = 1000000000.0;
    float4 hit = float4(0.0);
    float3 col;
    for (int i = 0; i < 12; i++)
    {
        if (i >= n)
        {
            break;
        }
        float a = ((float(i) * 6.283185482025146484375) / float(n)) + turn;
        float3 nrm = float3(sin(a), 0.0, cos(a));
        float dn = dot(rd, nrm);
        if (abs(dn) < 9.9999997473787516355514526367188e-05)
        {
            continue;
        }
        float t = dot((nrm * _88.uRadius) - ro, nrm) / dn;
        bool _422 = t <= 0.0;
        bool _429;
        if (!_422)
        {
            _429 = t >= tHit;
        }
        else
        {
            _429 = _422;
        }
        if (_429)
        {
            continue;
        }
        float3 p = (ro + (rd * t)) - (nrm * _88.uRadius);
        float2 l = float2(dot(p, float3(cos(a), 0.0, -sin(a))), p.y);
        float2 param = l;
        float2 param_1 = float2(0.550000011920928955078125, 0.75);
        float param_2 = 0.0500000007450580596923828125;
        float sd = roundedBox(param, param_1, param_2);
        float px = (t * 1.2000000476837158203125) / (1.60000002384185791015625 * _88.iResolution[1u]);
        float m = 1.0 - smoothstep(-px, px, sd);
        if (m <= 0.0)
        {
            continue;
        }
        float2 cuv = ((l / float2(0.550000011920928955078125, 0.75)) * 0.5) + float2(0.5);
        if (dn < 0.0)
        {
            float2 param_3 = cuv;
            int param_4 = i;
            col = cardFace(param_3, param_4, _88, uImage, uImageSmplr);
        }
        else
        {
            float lattice = (step(0.5, fract((cuv.x + cuv.y) * 9.0)) * 0.5) + (step(0.5, fract((cuv.x - cuv.y) * 9.0)) * 0.5);
            col = _88.uCardBack * (0.800000011920928955078125 + (0.25 * lattice));
            col = mix(col, float3(0.89999997615814208984375), float3(smoothstep(-0.0500000007450580596923828125, -0.039999999105930328369140625, sd) * 0.60000002384185791015625));
        }
        col *= (0.4000000059604644775390625 + (0.60000002384185791015625 * abs(dn)));
        col = mix(col, float3(1.0), float3(smoothstep((-0.01200000010430812835693359375) - px, -0.01200000010430812835693359375, sd) * 0.5));
        tHit = t;
        hit = float4(col, m);
    }
    return hit;
}

static inline __attribute__((always_inline))
void flair_opaqueImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _88, texture2d<float> uImage, sampler uImageSmplr)
{
    int n = clamp(_88.uCards, 3, 12);
    float k = _88.iTime / _88.uStep;
    float turn = ((-(floor(k) + smoothstep(0.550000011920928955078125, 1.0, fract(k)))) * 6.283185482025146484375) / float(n);
    float2 uv = (fragCoord - (float2(_88.iResolution[0], _88.iResolution[1]) * 0.5)) / float2(_88.iResolution[1u]);
    float3 eye = float3(0.0, 0.550000011920928955078125, _88.uRadius + 4.19999980926513671875);
    float3 f = fast::normalize(float3(0.0, -0.2199999988079071044921875, _88.uRadius * 0.5) - eye);
    float3 r = fast::normalize(cross(f, float3(0.0, 1.0, 0.0)));
    float3 rd = fast::normalize(((f * 1.60000002384185791015625) + (r * uv.x)) + (cross(r, f) * uv.y));
    float3 bg = mix(_88.uBackground * 0.550000011920928955078125, (_88.uBackground * 1.5) + float3(0.02999999932944774627685546875), float3(fast::clamp(uv.y + 0.60000002384185791015625, 0.0, 1.0)));
    bg *= (1.0 - (0.3499999940395355224609375 * dot(uv, uv)));
    float3 col = bg;
    float3 param = eye;
    float3 param_1 = rd;
    float param_2 = turn;
    int param_3 = n;
    float param_4;
    float4 _684 = cardsHit(param, param_1, param_2, param_3, param_4, _88, uImage, uImageSmplr);
    float tc = param_4;
    float4 card = _684;
    if (rd.y < 0.0)
    {
        float tf = ((-0.769999980926513671875) - eye.y) / rd.y;
        if ((tf > 0.0) && (tf < tc))
        {
            float3 p = eye + (rd * tf);
            float3 floorCol = _88.uBackground * 0.5;
            float3 param_5 = p;
            float3 param_6 = float3(rd.x, -rd.y, rd.z);
            float param_7 = turn;
            int param_8 = n;
            float param_9;
            float4 _736 = cardsHit(param_5, param_6, param_7, param_8, param_9, _88, uImage, uImageSmplr);
            float tr = param_9;
            float4 refl = _736;
            float fade = exp((-fast::max((-rd.y) * tr, 0.0)) * 2.400000095367431640625) * _88.uReflection;
            floorCol = mix(floorCol, refl.xyz, float3(refl.w * fade));
            col = mix(floorCol, bg, float3(smoothstep(_88.uRadius + 3.0, _88.uRadius + 9.0, tf)));
        }
    }
    col = mix(col, card.xyz, float3(card.w));
    fragColor = float4(col, 1.0);
}

static inline __attribute__((always_inline))
float4 flair_backgroundOpacity(thread const float4& c, thread const float3& bg, thread const float& opacity)
{
    if (opacity >= 1.0)
    {
        return c;
    }
    float3 d = fast::clamp(c.xyz, float3(0.0), float3(1.0)) - bg;
    float3 room = mix(bg, float3(1.0) - bg, step(float3(0.0), d));
    float3 k = abs(d) / fast::max(room, float3(9.9999997473787516355514526367188e-05));
    float a = fast::clamp(fast::max(k.x, fast::max(k.y, k.z)), 0.0, 1.0);
    float3 _830;
    if (a > 0.0)
    {
        _830 = bg + (d / float3(a));
    }
    else
    {
        _830 = bg;
    }
    float3 fg = _830;
    float alpha = a + (opacity * (1.0 - a));
    float3 _852;
    if (alpha > 0.0)
    {
        _852 = ((fg * a) + ((bg * opacity) * (1.0 - a))) / float3(alpha);
    }
    else
    {
        _852 = bg;
    }
    float3 col = _852;
    return float4(col, alpha * c.w);
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _88, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 param_1 = fragCoord;
    float4 param;
    flair_opaqueImage(param, param_1, _88, uImage, uImageSmplr);
    fragColor = param;
    float4 param_2 = fragColor;
    float3 param_3 = _88.uBackground;
    float param_4 = _88.uBackgroundAlpha;
    fragColor = flair_backgroundOpacity(param_2, param_3, param_4);
}

fragment flair_cover_flow_frag_out flair_cover_flow_frag(constant FlairUniforms& _88 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_cover_flow_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _909;
    if (_88.flair_flipY > 0.5)
    {
        _909 = _88.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _909 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _909);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _88, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

