// flair-metal-hash: 54b74330
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
    float uStrength;
    float uSpeed;
    float uWidth;
    float uLife;
    float uChroma;
    char _m18_pad[12];
    packed_float3 uEdge;
    float uFlash;
    uint uDemo;
    char _m21_pad[12];
    packed_float3 uBackdrop;
    float uBackdropAlpha;
};

struct flair_shockwave_frag_out
{
    float4 flair_FragColor [[color(0)]];
};

static inline __attribute__((always_inline))
float2 hash22(thread const float2& p)
{
    float3 p3 = fract(p.xyx * float3(0.103100001811981201171875, 0.10300000011920928955078125, 0.097300000488758087158203125));
    p3 += float3(dot(p3, p3.yzx + float3(33.3300018310546875)));
    return fract((p3.xx + p3.yz) * p3.zy);
}

static inline __attribute__((always_inline))
float4 hitAt(thread const int& i, thread const bool& demo, thread const float& every, constant FlairUniforms& _98)
{
    bool _85 = !demo;
    bool _107;
    if (!_85)
    {
        _107 = _98.iClicks[0].w > 0.5;
    }
    else
    {
        _107 = _85;
    }
    if (_107)
    {
        return _98.iClicks[i];
    }
    float k = floor(_98.iTime / every) - float(i);
    float2 param = float2((k * 1.37000000476837158203125) + 0.5, 3.7000000476837158203125);
    float2 h = hash22(param);
    return float4((float2(0.300000011920928955078125) + (h * 0.4000000059604644775390625)) * float2(_98.iResolution[0], _98.iResolution[1]), k * every, 1.0);
}

static inline __attribute__((always_inline))
float4 overBackdrop(thread const float4& s, constant FlairUniforms& _98)
{
    float3 colour = fast::min(s.xyz, float3(s.w)) + ((float3(_98.uBackdrop) * _98.uBackdropAlpha) * (1.0 - s.w));
    float alpha = s.w + (_98.uBackdropAlpha * (1.0 - s.w));
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
float4 pictureRGBA(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _98)
{
    float4 _297;
    if (int2(tex.get_width(), tex.get_height()).x > 1)
    {
        float4 param = tex.sample(texSmplr, uv);
        _297 = overBackdrop(param, _98);
    }
    else
    {
        float2 param_1 = fract(uv);
        _297 = float4(testCard(param_1), 1.0);
    }
    return _297;
}

static inline __attribute__((always_inline))
float3 picture(texture2d<float> tex, sampler texSmplr, thread const float2& uv, constant FlairUniforms& _98)
{
    float2 param = uv;
    return pictureRGBA(tex, texSmplr, param, _98).xyz;
}

static inline __attribute__((always_inline))
void mainImage(thread float4& fragColor, thread const float2& fragCoord, constant FlairUniforms& _98, texture2d<float> uImage, sampler uImageSmplr)
{
    float2 uv = fragCoord / float2(_98.iResolution[0], _98.iResolution[1]);
    float px = 1.0 / _98.iResolution[1u];
    float2 off = float2(0.0);
    float edge = 0.0;
    float shade = 0.0;
    float flash = 0.0;
    for (int i = 0; i < 4; i++)
    {
        int param = i;
        bool param_1 = _98.uDemo != 0u;
        float param_2 = 2.2000000476837158203125;
        float4 c = hitAt(param, param_1, param_2, _98);
        if (c.w < 0.5)
        {
            continue;
        }
        float age = _98.iTime - c.z;
        bool _374 = age < 0.0;
        bool _383;
        if (!_374)
        {
            _383 = age > _98.uLife;
        }
        else
        {
            _383 = _374;
        }
        if (_383)
        {
            continue;
        }
        float2 d = (fragCoord - c.xy) * px;
        float r = length(d);
        float2 dir = d / float2(fast::max(r, 9.9999997473787516355514526367188e-06));
        float life = age / _98.uLife;
        float fade = (1.0 - life) * (1.0 - life);
        float R = age * _98.uSpeed;
        float w = _98.uWidth * (0.60000002384185791015625 + (life * 1.39999997615814208984375));
        float x = (r - R) / w;
        float lens = ((-x) * exp((-x) * x)) * smoothstep(0.0, 0.039999999105930328369140625, R);
        off += (((((dir * lens) * _98.uStrength) * w) * 1.2000000476837158203125) * fade);
        shade += (lens * fade);
        float front = (x - 0.699999988079071044921875) * 3.0;
        edge += (exp((-front) * front) * fade);
        flash += (exp((-age) * 14.0) * exp(((-r) * r) / (0.02999999932944774627685546875 + (age * 0.300000011920928955078125))));
    }
    float2 o = off * float2(_98.iResolution[1u] / _98.iResolution[0u], 1.0);
    float2 param_3 = uv - o;
    float4 pic = pictureRGBA(uImage, uImageSmplr, param_3, _98);
    float3 col = pic.xyz;
    float2 param_4 = uv - (o * (1.0 + (_98.uChroma * 1.5)));
    col.x = picture(uImage, uImageSmplr, param_4, _98).x;
    float2 param_5 = uv - (o * (1.0 - (_98.uChroma * 1.5)));
    col.z = picture(uImage, uImageSmplr, param_5, _98).z;
    col *= (1.0 + ((shade * 0.25) * _98.uStrength));
    col += ((float3(_98.uEdge) * edge) * 0.550000011920928955078125);
    col = mix(col, float3(1.0), float3(fast::clamp(flash * _98.uFlash, 0.0, 1.0)));
    float glow = fast::clamp((edge * 0.550000011920928955078125) + (flash * _98.uFlash), 0.0, 1.0);
    fragColor = float4(col, fast::max(pic.w, glow));
}

fragment flair_shockwave_frag_out flair_shockwave_frag(constant FlairUniforms& _98 [[buffer(0)]], texture2d<float> uImage [[texture(1)]], sampler uImageSmplr [[sampler(1)]], float4 gl_FragCoord [[position]])
{
    flair_shockwave_frag_out out = {};
    float4 flair_color = float4(0.0, 0.0, 0.0, 1.0);
    float _606;
    if (_98.flair_flipY > 0.5)
    {
        _606 = _98.iResolution[1u] - gl_FragCoord.y;
    }
    else
    {
        _606 = gl_FragCoord.y;
    }
    float2 flair_coord = float2(gl_FragCoord.x, _606);
    float2 param_1 = flair_coord;
    float4 param;
    mainImage(param, param_1, _98, uImage, uImageSmplr);
    flair_color = param;
    out.flair_FragColor = flair_color;
    return out;
}

